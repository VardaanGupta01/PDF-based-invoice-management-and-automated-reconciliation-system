CREATE TABLE IF NOT EXISTS users (
    id INT AUTO_INCREMENT PRIMARY KEY,
    username VARCHAR(255) NOT NULL,
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    last_active_business_id INT DEFAULT NULL,
    reset_token VARCHAR(255) DEFAULT NULL,
    reset_token_expires DATETIME DEFAULT NULL,
    refresh_token VARCHAR(500) DEFAULT NULL,
    is_system_admin BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS businesses (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL,
    business_name VARCHAR(255) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS bank_accounts (
    id INT AUTO_INCREMENT PRIMARY KEY,
    business_id INT NOT NULL,
    bank_name VARCHAR(100) NOT NULL,
    account_nickname VARCHAR(255),
    account_last_four VARCHAR(4),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (business_id) REFERENCES businesses (id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS ledgers (
    id INT AUTO_INCREMENT PRIMARY KEY,
    bank_account_id INT NOT NULL,
    target_month INT NOT NULL, -- 1-12
    target_year INT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (bank_account_id) REFERENCES bank_accounts (id) ON DELETE CASCADE,
    -- Only ONE ledger allowed per bank account per month per year
    UNIQUE KEY unique_ledger_period (
        bank_account_id,
        target_month,
        target_year
    )
);

CREATE TABLE IF NOT EXISTS ledger_files (
    id INT AUTO_INCREMENT PRIMARY KEY,
    ledger_id INT NOT NULL,
    file_path VARCHAR(255) NOT NULL,
    file_type ENUM('excel_ledger', 'invoice_pdf') NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (ledger_id) REFERENCES ledgers (id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS ledger_records (
    id INT AUTO_INCREMENT PRIMARY KEY,
    ledger_id INT NOT NULL,
    ledger_file_id INT DEFAULT NULL,
    transaction_id VARCHAR(255),
    index_number INT,
    is_reconciled BOOLEAN DEFAULT FALSE,
    transaction_date DATE NOT NULL,
    amount DECIMAL(15, 2) NOT NULL,
    transaction_type ENUM('debit', 'credit') NOT NULL,
    description TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (ledger_file_id) REFERENCES ledger_files (id) ON DELETE SET NULL,
    FOREIGN KEY (ledger_id) REFERENCES ledgers (id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS bank_statement_groups (
    id INT AUTO_INCREMENT PRIMARY KEY,
    bank_account_id INT NOT NULL,
    name VARCHAR(255) NOT NULL,
    target_month INT NOT NULL, -- 1-12
    target_year INT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (bank_account_id) REFERENCES bank_accounts (id) ON DELETE CASCADE,
    -- Only ONE bank statement group allowed per bank account per month per year
    UNIQUE KEY unique_statement_period (
        bank_account_id,
        target_month,
        target_year
    )
);

CREATE TABLE IF NOT EXISTS bank_statement_files (
    id INT AUTO_INCREMENT PRIMARY KEY,
    bank_statement_group_id INT NOT NULL,
    file_path VARCHAR(255) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (bank_statement_group_id) REFERENCES bank_statement_groups (id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS bank_statement_records (
    id INT AUTO_INCREMENT PRIMARY KEY,
    bank_statement_group_id INT NOT NULL,
    bank_statement_file_id INT DEFAULT NULL,
    transaction_id VARCHAR(255),
    invoice_number VARCHAR(100) DEFAULT NULL,
    index_number INT,
    is_reconciled BOOLEAN DEFAULT FALSE,
    transaction_date DATE NOT NULL,
    amount DECIMAL(15, 2) NOT NULL,
    transaction_type ENUM('debit', 'credit') NOT NULL,
    description TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (bank_statement_group_id) REFERENCES bank_statement_groups (id) ON DELETE CASCADE,
    FOREIGN KEY (bank_statement_file_id) REFERENCES bank_statement_files (id) ON DELETE SET NULL
);

-- invoice_number column is already included in the CREATE TABLE above.
-- The ALTER below is kept only as a migration guard for legacy databases
-- that were created before the column was added to CREATE TABLE.
-- initSchema.js swallows ER_DUP_FIELDNAME so this is harmless but noisy.
-- ALTER TABLE bank_statement_records
--     ADD COLUMN invoice_number VARCHAR(100) DEFAULT NULL AFTER transaction_id;

CREATE TABLE IF NOT EXISTS reconciliation_groups (
    id INT AUTO_INCREMENT PRIMARY KEY,
    ledger_id INT NOT NULL,
    bank_statement_group_id INT NOT NULL,
    status ENUM('in_progress', 'completed') DEFAULT 'in_progress',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    completed_at TIMESTAMP NULL,
    FOREIGN KEY (ledger_id) REFERENCES ledgers (id) ON DELETE CASCADE,
    FOREIGN KEY (bank_statement_group_id) REFERENCES bank_statement_groups (id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS reconciliation_matches (
    id INT AUTO_INCREMENT PRIMARY KEY,
    reconciliation_id INT NOT NULL,
    ledger_record_id INT DEFAULT NULL,
    bank_statement_record_id INT DEFAULT NULL,
    match_type ENUM(
        'auto_exact',
        'auto_partial',
        'manual'
    ) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (reconciliation_id) REFERENCES reconciliation_groups (id) ON DELETE CASCADE,
    FOREIGN KEY (ledger_record_id) REFERENCES ledger_records (id) ON DELETE SET NULL,
    FOREIGN KEY (bank_statement_record_id) REFERENCES bank_statement_records (id) ON DELETE SET NULL
);

-- ALTER TABLE users
-- ADD COLUMN last_active_business_id INT,
-- ADD FOREIGN KEY (last_active_business_id) REFERENCES businesses(id) ON DELETE SET NULL;

-- ALTER TABLE ledgers ADD UNIQUE KEY unique_ledger_period (bank_account_id, target_month, target_year);
-- ALTER TABLE bank_statement_groups ADD UNIQUE KEY unique_statement_period (bank_account_id, target_month, target_year);
-- ALTER TABLE ledgers DROP COLUMN name;


CREATE TABLE IF NOT EXISTS reconciliation_results (
    id INT AUTO_INCREMENT PRIMARY KEY,
    reconciliation_id INT NOT NULL,
    ledger_record_id INT DEFAULT NULL,
    bank_statement_record_id INT DEFAULT NULL,
    invoice_id VARCHAR(255),
    description TEXT,
    transaction_type ENUM('debit', 'credit') DEFAULT NULL,
    invoice_amount DECIMAL(15, 2) DEFAULT NULL,
    bank_amount DECIMAL(15, 2) DEFAULT NULL,
    bank_txn_id VARCHAR(255) DEFAULT NULL,
    result TINYINT UNSIGNED NOT NULL DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (reconciliation_id) REFERENCES reconciliation_groups (id) ON DELETE CASCADE,
    FOREIGN KEY (ledger_record_id) REFERENCES ledger_records (id) ON DELETE SET NULL,
    FOREIGN KEY (bank_statement_record_id) REFERENCES bank_statement_records (id) ON DELETE SET NULL
);

-- Run this once if the legacy 'name' column still exists in your DB:
-- ALTER TABLE ledgers MODIFY COLUMN name VARCHAR(255) NULL DEFAULT NULL;

ALTER TABLE users ADD COLUMN reset_token VARCHAR(255) DEFAULT NULL;
ALTER TABLE users ADD COLUMN reset_token_expires DATETIME DEFAULT NULL;
ALTER TABLE users ADD COLUMN refresh_token VARCHAR(500) DEFAULT NULL;
ALTER TABLE users ADD COLUMN is_system_admin BOOLEAN DEFAULT FALSE;

CREATE TABLE IF NOT EXISTS user_business_roles (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL,
    business_id INT NOT NULL,
    role ENUM('admin', 'accountant', 'viewer') NOT NULL DEFAULT 'accountant',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE,
    FOREIGN KEY (business_id) REFERENCES businesses (id) ON DELETE CASCADE,
    UNIQUE KEY unique_user_business (user_id, business_id)
);

CREATE TABLE IF NOT EXISTS invitations (
    id INT AUTO_INCREMENT PRIMARY KEY,
    business_id INT NOT NULL,
    inviter_user_id INT NOT NULL,
    email VARCHAR(255) NOT NULL,
    role ENUM('accountant', 'viewer') NOT NULL DEFAULT 'viewer',
    token VARCHAR(255) UNIQUE NOT NULL,
    expires_at DATETIME NOT NULL,
    status ENUM('pending', 'accepted', 'expired', 'revoked') DEFAULT 'pending',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (business_id) REFERENCES businesses (id) ON DELETE CASCADE,
    FOREIGN KEY (inviter_user_id) REFERENCES users (id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS audit_logs (
    id INT AUTO_INCREMENT PRIMARY KEY,
    business_id INT DEFAULT NULL,
    user_id INT NOT NULL,
    action VARCHAR(100) NOT NULL,
    entity_type VARCHAR(100) NOT NULL,
    entity_id VARCHAR(255) DEFAULT NULL,
    details JSON DEFAULT NULL,
    ip_address VARCHAR(45) DEFAULT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
);