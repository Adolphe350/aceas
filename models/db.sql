-- ACEAS Database Schema

CREATE TABLE IF NOT EXISTS users (
  id SERIAL PRIMARY KEY,
  full_name VARCHAR(100) NOT NULL,
  email VARCHAR(150) UNIQUE NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  role VARCHAR(30) NOT NULL CHECK (role IN ('ai_developer', 'compliance_officer', 'system_admin')),
  is_active BOOLEAN DEFAULT TRUE,
  mfa_enabled BOOLEAN DEFAULT TRUE,
  failed_login_attempts INT DEFAULT 0,
  locked_until TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS otp_store (
  id SERIAL PRIMARY KEY,
  user_id INT REFERENCES users(id) ON DELETE CASCADE,
  otp_hash VARCHAR(255) NOT NULL,
  expires_at TIMESTAMP NOT NULL,
  used BOOLEAN DEFAULT FALSE,
  attempts INT DEFAULT 0,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS projects (
  id SERIAL PRIMARY KEY,
  developer_id INT REFERENCES users(id),
  title VARCHAR(200) NOT NULL,
  description TEXT,
  ai_type VARCHAR(100),
  purpose TEXT,
  dataset_info TEXT,
  status VARCHAR(30) DEFAULT 'pending'
    CHECK (status IN ('pending', 'under_review', 'approved', 'rejected', 'changes_requested')),
  submitted_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS assessments (
  id SERIAL PRIMARY KEY,
  project_id INT REFERENCES projects(id) ON DELETE CASCADE,
  q1 BOOLEAN, q2 BOOLEAN, q3 BOOLEAN, q4 BOOLEAN,
  q5 BOOLEAN, q6 BOOLEAN, q7 BOOLEAN, q8 BOOLEAN,
  q9 BOOLEAN, q10 BOOLEAN, q11 BOOLEAN, q12 BOOLEAN,
  q13 BOOLEAN, q14 BOOLEAN, q15 BOOLEAN, q16 BOOLEAN,
  q17 BOOLEAN, q18 BOOLEAN, q19 BOOLEAN, q20 BOOLEAN,
  privacy_score NUMERIC(5,2),
  fairness_score NUMERIC(5,2),
  security_score NUMERIC(5,2),
  transparency_score NUMERIC(5,2),
  accountability_score NUMERIC(5,2),
  overall_score NUMERIC(5,2),
  risk_level VARCHAR(20) CHECK (risk_level IN ('Low Risk', 'Medium Risk', 'High Risk', 'Critical Risk')),
  ai_recommendations TEXT,
  assessed_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS reviews (
  id SERIAL PRIMARY KEY,
  project_id INT REFERENCES projects(id) ON DELETE CASCADE,
  officer_id INT REFERENCES users(id),
  comments TEXT,
  decision VARCHAR(30) CHECK (decision IN ('approved', 'rejected', 'changes_requested')),
  reviewed_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS audit_log (
  id SERIAL PRIMARY KEY,
  user_id INT REFERENCES users(id),
  action VARCHAR(200) NOT NULL,
  entity_type VARCHAR(50),
  entity_id INT,
  ip_address VARCHAR(45),
  created_at TIMESTAMP DEFAULT NOW()
);
