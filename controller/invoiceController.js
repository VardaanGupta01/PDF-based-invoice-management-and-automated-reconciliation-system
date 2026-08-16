const db = require('../config/db');
const LedgerModel = require('../model/ledgerModel');
const { parsePdf } = require('../parsing/parser');
const { uploadToCloudinary } = require('../config/cloudinary');
const { logAudit } = require('../utils/auditLogger');

const uploadInvoice = async (req, res) => {
    try {
        if (!req.file || !req.file.buffer) {
            return res.status(400).json({ message: "No file uploaded" });
        }

        const ledger_id = req.body.ledger_id;
        if (!ledger_id) {
            return res.status(400).json({ message: "ledger_id is required" });
        }

        // 1. Upload memory buffer to Cloudinary with local disk fallback
        let fileUrl = '';
        let cloudinaryId = null;

        try {
            if (process.env.CLOUDINARY_CLOUD_NAME || process.env.CLOUDINARY_URL) {
                const cloudinaryResult = await uploadToCloudinary(req.file.buffer, {
                    folder: 'invoices',
                    resource_type: 'raw'
                });
                fileUrl = cloudinaryResult.secure_url;
                cloudinaryId = cloudinaryResult.public_id;
            } else {
                throw new Error('Cloudinary not configured');
            }
        } catch (cloudErr) {
            console.warn('[Invoice Upload] Cloudinary upload failed or unconfigured, using local file storage fallback:', cloudErr.message);
            const fs = require('fs');
            const path = require('path');
            const { uploadDirs } = require('../config/env');
            if (!fs.existsSync(uploadDirs.invoices)) {
                fs.mkdirSync(uploadDirs.invoices, { recursive: true });
            }
            const fileName = `${Date.now()}_${req.file.originalname}`;
            const localPath = path.join(uploadDirs.invoices, fileName);
            fs.writeFileSync(localPath, req.file.buffer);
            fileUrl = `/uploads/invoices/${fileName}`;
        }

        // 2. Save URL record to ledger_files table
        const ledger_file_id = await LedgerModel.addFile(ledger_id, fileUrl, 'invoice_pdf');

        // 3. Parse the PDF directly from RAM buffer — returns array of invoice records
        const invoiceRecords = await parsePdf(req.file.buffer);

        // 4. Insert all parsed records into ledger_records
        const insertedIds = await LedgerModel.addRecords(ledger_id, ledger_file_id, invoiceRecords);

        await logAudit(req, {
            action: 'UPLOAD_INVOICE',
            entityType: 'invoice_pdf',
            entityId: ledger_file_id,
            details: { fileName: req.file.originalname, recordsCount: insertedIds.length }
        });

        res.status(200).json({
            message: `PDF uploaded and parsed successfully! ${insertedIds.length} record(s) created.`,
            fileUrl: fileUrl,
            fileName: req.file.originalname,
            cloudinaryId: cloudinaryId,
            records: invoiceRecords,
            recordIds: insertedIds
        });
    } catch (error) {
        console.error("Upload/Parse error:", error);
        res.status(500).json({ message: error.message || "Server error during PDF processing" });
    }
};

// Get dashboard statistics from database
const getDashboardStats = async (req, res) => {
    try {
        const currentMonthCondition = "MONTH(created_at) = MONTH(CURRENT_DATE()) AND YEAR(created_at) = YEAR(CURRENT_DATE())";
        const previousMonthCondition = "MONTH(created_at) = MONTH(CURRENT_DATE() - INTERVAL 1 MONTH) AND YEAR(created_at) = YEAR(CURRENT_DATE() - INTERVAL 1 MONTH)";

        const [matchCounts] = await db.execute(`
            SELECT 
                match_type,
                SUM(CASE WHEN ${currentMonthCondition} THEN 1 ELSE 0 END) as current_month_count,
                SUM(CASE WHEN ${previousMonthCondition} THEN 1 ELSE 0 END) as prev_month_count,
                COUNT(*) as all_time_count
            FROM reconciliation_matches
            GROUP BY match_type
        `);

        // We also need total records and unmatched. 
        // We can do this in single queries per table as well.
        const [ledgerCounts] = await db.execute(`
            SELECT 
                SUM(CASE WHEN ${currentMonthCondition} THEN 1 ELSE 0 END) as current_month_total,
                SUM(CASE WHEN ${previousMonthCondition} THEN 1 ELSE 0 END) as prev_month_total,
                COUNT(*) as all_time_total,
                SUM(CASE WHEN is_reconciled = 0 AND ${currentMonthCondition} THEN 1 ELSE 0 END) as current_unmatched,
                SUM(CASE WHEN is_reconciled = 0 AND ${previousMonthCondition} THEN 1 ELSE 0 END) as prev_unmatched,
                SUM(CASE WHEN is_reconciled = 0 THEN 1 ELSE 0 END) as all_time_unmatched
            FROM ledger_records
        `);

        const [bankCounts] = await db.execute(`
            SELECT 
                SUM(CASE WHEN ${currentMonthCondition} THEN 1 ELSE 0 END) as current_month_total,
                SUM(CASE WHEN ${previousMonthCondition} THEN 1 ELSE 0 END) as prev_month_total,
                COUNT(*) as all_time_total,
                SUM(CASE WHEN is_reconciled = 0 AND ${currentMonthCondition} THEN 1 ELSE 0 END) as current_unmatched,
                SUM(CASE WHEN is_reconciled = 0 AND ${previousMonthCondition} THEN 1 ELSE 0 END) as prev_unmatched,
                SUM(CASE WHEN is_reconciled = 0 THEN 1 ELSE 0 END) as all_time_unmatched
            FROM bank_statement_records
        `);

        let exactAllTime = 0, exactCurr = 0, exactPrev = 0;
        let partialAllTime = 0, partialCurr = 0, partialPrev = 0;
        let manualAllTime = 0, manualCurr = 0, manualPrev = 0;

        matchCounts.forEach(row => {
            const mType = String(row.match_type).toUpperCase();
            if (mType === 'AUTO_EXACT') {
                exactAllTime += Number(row.all_time_count);
                exactCurr += Number(row.current_month_count || 0);
                exactPrev += Number(row.prev_month_count || 0);
            } else if (mType === 'AUTO_PARTIAL') {
                partialAllTime += Number(row.all_time_count);
                partialCurr += Number(row.current_month_count || 0);
                partialPrev += Number(row.prev_month_count || 0);
            } else if (mType === 'MANUAL_OVERRIDE') {
                manualAllTime += Number(row.all_time_count);
                manualCurr += Number(row.current_month_count || 0);
                manualPrev += Number(row.prev_month_count || 0);
            }
        });

        const totalAllTime = Number(ledgerCounts[0]?.all_time_total || 0) + Number(bankCounts[0]?.all_time_total || 0);
        const totalCurr = Number(ledgerCounts[0]?.current_month_total || 0) + Number(bankCounts[0]?.current_month_total || 0);
        const totalPrev = Number(ledgerCounts[0]?.prev_month_total || 0) + Number(bankCounts[0]?.prev_month_total || 0);

        const unmatchedAllTime = Number(ledgerCounts[0]?.all_time_unmatched || 0) + Number(bankCounts[0]?.all_time_unmatched || 0);
        const unmatchedCurr = Number(ledgerCounts[0]?.current_unmatched || 0) + Number(bankCounts[0]?.current_unmatched || 0);
        const unmatchedPrev = Number(ledgerCounts[0]?.prev_unmatched || 0) + Number(bankCounts[0]?.prev_unmatched || 0);

        const currTotalSafe = totalCurr > 0 ? totalCurr : 1;
        const prevTotalSafe = totalPrev > 0 ? totalPrev : 1;

        const exactRate = ((exactCurr / currTotalSafe) * 100).toFixed(1);
        const partialRate = ((partialCurr / currTotalSafe) * 100).toFixed(1);
        const manualRate = ((manualCurr / currTotalSafe) * 100).toFixed(1);
        const unmatchedRate = ((unmatchedCurr / currTotalSafe) * 100).toFixed(1);

        const calcTrend = (currVal, prevVal) => {
            if (prevVal === 0) return currVal > 0 ? "+100.0" : "0.0";
            const diff = currVal - prevVal;
            const pct = (diff / prevVal) * 100;
            return (pct > 0 ? "+" : "") + pct.toFixed(1);
        };

        const exactTrend = calcTrend(exactCurr, exactPrev);
        const partialTrend = calcTrend(partialCurr, partialPrev);
        const manualTrend = calcTrend(manualCurr, manualPrev);
        const unmatchedTrend = calcTrend(unmatchedCurr, unmatchedPrev);

        // Overall trend calculated as difference in all-time rate from previous month's all-time rate
        const prevTotalAllTimeSafe = (totalAllTime - totalCurr) > 0 ? (totalAllTime - totalCurr) : 1;
        const calcOverallTrend = (allTime, curr, totalAll, totalPrevAll) => {
            const prevAllTime = allTime - curr;
            const prevRate = (prevAllTime / totalPrevAll) * 100;
            const currRate = (allTime / (totalAll > 0 ? totalAll : 1)) * 100;
            const diff = currRate - prevRate;
            return (diff > 0 ? "+" : "") + diff.toFixed(1);
        };

        const overallExactTrend = calcOverallTrend(exactAllTime, exactCurr, totalAllTime, prevTotalAllTimeSafe);
        const overallPartialTrend = calcOverallTrend(partialAllTime, partialCurr, totalAllTime, prevTotalAllTimeSafe);
        const overallManualTrend = calcOverallTrend(manualAllTime, manualCurr, totalAllTime, prevTotalAllTimeSafe);
        const overallUnmatchedTrend = calcOverallTrend(unmatchedAllTime, unmatchedCurr, totalAllTime, prevTotalAllTimeSafe);

        // Get recent matches from reconciliation_matches
        const [recentMatches] = await db.execute(`
            SELECT 
                rm.id,
                rm.match_type,
                rm.created_at as match_date,
                lr.transaction_id,
                lr.transaction_type,
                lr.amount,
                bs.transaction_id as bank_transaction_id,
                bs.amount as bank_amount
            FROM reconciliation_matches rm
            LEFT JOIN ledger_records lr ON rm.invoice_id = lr.id
            LEFT JOIN bank_statement_records bs ON rm.transaction_id = bs.id
            ORDER BY rm.created_at DESC
            LIMIT 10
        `);

        res.status(200).json({
            latestMonthStats: {
                month: new Date().toLocaleString('default', { month: 'long', year: 'numeric' }),
                total_records: totalCurr,
                exact_matches: exactCurr,
                partial_matches: partialCurr,
                manual_matches: manualCurr,
                unmatched: unmatchedCurr,
                exact_match_rate: exactRate,
                partial_match_rate: partialRate,
                manual_match_rate: manualRate,
                unmatched_rate: unmatchedRate,
                exact_trend: exactTrend,
                exact_trend_dir: exactTrend === "0.0" ? 'neutral' : parseFloat(exactTrend) >= 0 ? 'up' : 'down',
                partial_trend: partialTrend,
                partial_trend_dir: partialTrend === "0.0" ? 'neutral' : parseFloat(partialTrend) >= 0 ? 'up' : 'down',
                manual_trend: manualTrend,
                manual_trend_dir: manualTrend === "0.0" ? 'neutral' : parseFloat(manualTrend) >= 0 ? 'up' : 'down',
                unmatched_trend: unmatchedTrend,
                unmatched_trend_dir: unmatchedTrend === "0.0" ? 'neutral' : parseFloat(unmatchedTrend) >= 0 ? 'up' : 'down'
            },
            overallStats: {
                total_records_processed: totalAllTime,
                all_time_exact: exactAllTime,
                all_time_partial: partialAllTime,
                all_time_manual: manualAllTime,
                all_time_unmatched: unmatchedAllTime,
                exact_trend: overallExactTrend,
                exact_trend_dir: overallExactTrend === "0.0" ? 'neutral' : parseFloat(overallExactTrend) >= 0 ? 'up' : 'down',
                partial_trend: overallPartialTrend,
                partial_trend_dir: overallPartialTrend === "0.0" ? 'neutral' : parseFloat(overallPartialTrend) >= 0 ? 'up' : 'down',
                manual_trend: overallManualTrend,
                manual_trend_dir: overallManualTrend === "0.0" ? 'neutral' : parseFloat(overallManualTrend) >= 0 ? 'up' : 'down',
                unmatched_trend: overallUnmatchedTrend,
                unmatched_trend_dir: overallUnmatchedTrend === "0.0" ? 'neutral' : parseFloat(overallUnmatchedTrend) >= 0 ? 'up' : 'down'
            },
            recentMatches: recentMatches.map((row, index) => ({
                id: row.id || index + 1,
                transaction_id: row.transaction_id || `TXN-${2025}${String(index + 1).padStart(6, '0')}`,
                transaction_type: row.transaction_type || 'Debit',
                amount: parseFloat(row.amount) || parseFloat(row.bank_amount) || 0,
                match_type: row.match_type === 'AUTO_EXACT' ? 'exact' : row.match_type === 'AUTO_PARTIAL' ? 'partial' : 'manual',
                match_date: row.match_date ? new Date(row.match_date).toISOString().split('T')[0] : new Date().toISOString().split('T')[0]
            }))
        });
    } catch (error) {
        console.error("Dashboard stats error:", error);
        res.status(500).json({ message: "Server error fetching dashboard stats" });
    }
};

module.exports = {
    uploadInvoice,
    getDashboardStats
};
