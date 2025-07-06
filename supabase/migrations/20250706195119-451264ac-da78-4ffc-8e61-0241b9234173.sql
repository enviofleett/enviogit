-- Phase 1: Create sample test data with correct scenario_type values

-- Insert sample synthetic test runs
INSERT INTO synthetic_test_runs (
  id,
  started_at,
  completed_at,
  total_scenarios,
  passed_scenarios,
  failed_scenarios,
  skipped_scenarios,
  execution_time_ms,
  environment,
  run_type,
  status,
  configuration
) VALUES 
(
  gen_random_uuid(),
  now() - interval '2 hours',
  now() - interval '1 hour 45 minutes',
  15,
  12,
  2,
  1,
  135000,
  'production',
  'scheduled',
  'completed',
  '{"browser": "chrome", "viewport": "1920x1080", "timeout": 30000}'::jsonb
),
(
  gen_random_uuid(),
  now() - interval '6 hours',
  now() - interval '5 hours 30 minutes',
  12,
  11,
  1,
  0,
  98000,
  'test',
  'manual',
  'completed',
  '{"browser": "firefox", "viewport": "1366x768", "timeout": 30000}'::jsonb
),
(
  gen_random_uuid(),
  now() - interval '12 hours',
  now() - interval '11 hours 15 minutes',
  18,
  15,
  3,
  0,
  156000,
  'staging',
  'scheduled',
  'completed',
  '{"browser": "chrome", "viewport": "1920x1080", "timeout": 45000}'::jsonb
),
(
  gen_random_uuid(),
  now() - interval '1 day',
  now() - interval '23 hours 30 minutes',
  20,
  18,
  1,
  1,
  178000,
  'production',
  'scheduled',
  'completed',
  '{"browser": "safari", "viewport": "1440x900", "timeout": 30000}'::jsonb
),
(
  gen_random_uuid(),
  now() - interval '10 minutes',
  NULL,
  8,
  5,
  0,
  0,
  NULL,
  'test',
  'manual',
  'running',
  '{"browser": "chrome", "viewport": "1920x1080", "timeout": 30000}'::jsonb
);

-- Insert sample synthetic test scenarios
INSERT INTO synthetic_test_scenarios (
  id,
  name,
  description,
  scenario_type,
  environment,
  test_steps,
  expected_outcomes,
  is_active,
  timeout_seconds,
  retry_count,
  priority,
  tags
) VALUES
(
  gen_random_uuid(),
  'Customer Registration Journey',
  'Test complete customer registration process from signup to first purchase',
  'customer',
  'production',
  '[
    {"action": "navigate", "url": "/auth", "description": "Navigate to registration page"},
    {"action": "fillForm", "selector": "#email", "value": "test@example.com", "description": "Enter email"},
    {"action": "fillForm", "selector": "#password", "value": "TestPass123!", "description": "Enter password"},
    {"action": "click", "selector": "#register-btn", "description": "Click register button"},
    {"action": "waitFor", "selector": ".dashboard", "timeout": 5000, "description": "Wait for dashboard"},
    {"action": "navigate", "url": "/marketplace", "description": "Navigate to marketplace"},
    {"action": "click", "selector": ".service-card:first-child", "description": "Select first service"},
    {"action": "click", "selector": "#purchase-btn", "description": "Click purchase button"}
  ]'::jsonb,
  '{"expectedPages": ["/auth", "/dashboard", "/marketplace"], "expectedElements": [".dashboard", ".service-card"], "maxLoadTime": 3000}'::jsonb,
  true,
  300,
  3,
  1,
  '["customer", "registration", "purchase", "e2e"]'::jsonb
),
(
  gen_random_uuid(),
  'Merchant Onboarding Flow',
  'Test merchant registration and service offering creation',
  'merchant',
  'production',
  '[
    {"action": "navigate", "url": "/auth", "description": "Navigate to registration page"},
    {"action": "fillForm", "selector": "#email", "value": "merchant@example.com", "description": "Enter merchant email"},
    {"action": "fillForm", "selector": "#password", "value": "MerchantPass123!", "description": "Enter password"},
    {"action": "click", "selector": "#register-btn", "description": "Click register button"},
    {"action": "navigate", "url": "/marketplace/merchant", "description": "Navigate to merchant section"},
    {"action": "fillForm", "selector": "#business-name", "value": "Test Business", "description": "Enter business name"},
    {"action": "click", "selector": "#create-offering-btn", "description": "Create service offering"}
  ]'::jsonb,
  '{"expectedPages": ["/auth", "/marketplace/merchant"], "expectedElements": [".merchant-dashboard"], "maxLoadTime": 3000}'::jsonb,
  true,
  240,
  2,
  2,
  '["merchant", "onboarding", "business"]'::jsonb
),
(
  gen_random_uuid(),
  'Technical Partner Registration',
  'Test technical partner registration and earnings tracking',
  'technical_partner',
  'production',
  '[
    {"action": "navigate", "url": "/auth", "description": "Navigate to registration page"},
    {"action": "fillForm", "selector": "#email", "value": "partner@example.com", "description": "Enter partner email"},
    {"action": "fillForm", "selector": "#password", "value": "PartnerPass123!", "description": "Enter password"},
    {"action": "click", "selector": "#register-btn", "description": "Click register button"},
    {"action": "navigate", "url": "/partner/dashboard", "description": "Navigate to partner dashboard"},
    {"action": "waitFor", "selector": ".earnings-card", "timeout": 3000, "description": "Wait for earnings display"}
  ]'::jsonb,
  '{"expectedPages": ["/auth", "/partner/dashboard"], "expectedElements": [".earnings-card"], "maxLoadTime": 3000}'::jsonb,
  true,
  180,
  2,
  2,
  '["technical-partner", "registration", "earnings"]'::jsonb
),
(
  gen_random_uuid(),
  'Admin Operations Workflow',
  'Test admin approval and monitoring workflows',
  'admin',
  'production',  
  '[
    {"action": "navigate", "url": "/auth", "description": "Navigate to login page"},
    {"action": "fillForm", "selector": "#email", "value": "admin@example.com", "description": "Enter admin email"},
    {"action": "fillForm", "selector": "#password", "value": "AdminPass123!", "description": "Enter password"},
    {"action": "click", "selector": "#login-btn", "description": "Click login button"},
    {"action": "navigate", "url": "/admin/merchants", "description": "Navigate to merchant approvals"},
    {"action": "click", "selector": ".approve-btn:first-child", "description": "Approve first merchant"},
    {"action": "navigate", "url": "/developer", "description": "Navigate to monitoring dashboard"}
  ]'::jsonb,
  '{"expectedPages": ["/auth", "/admin/merchants", "/developer"], "expectedElements": [".approve-btn", ".monitoring-dashboard"], "maxLoadTime": 3000}'::jsonb,
  true,
  120,
  3,
  1,
  '["admin", "approval", "monitoring"]'::jsonb
);

-- Insert sample monitoring alerts
INSERT INTO synthetic_monitoring_alerts (
  id,
  alert_type,
  severity,
  title,
  description,
  environment,
  metadata,
  created_at,
  resolved_at,
  notification_sent
) VALUES
(
  gen_random_uuid(),
  'performance_degradation',
  'high',
  'GPS51 API Slow Response',
  'GPS51 API response time exceeded 10 seconds during health check',
  'production',
  '{"responseTime": 12500, "endpoint": "gps51-health-monitor", "threshold": 10000}'::jsonb,
  now() - interval '2 hours',
  now() - interval '1 hour',
  true
),
(
  gen_random_uuid(),
  'environment_down',
  'critical',
  'GPS51 Rate Limit Error (8902)',
  'GPS51 API returned status 8902 indicating rate limiting active',
  'production',
  '{"errorCode": 8902, "message": "Rate limit exceeded", "consecutiveFailures": 3}'::jsonb,
  now() - interval '6 hours',
  now() - interval '5 hours',
  true
),
(
  gen_random_uuid(),
  'test_failure',
  'medium',
  'Customer Journey Test Failed',
  'Customer registration journey test failed at payment step',
  'staging',
  '{"failedStep": "payment", "testRun": "customer-registration", "errorMessage": "Payment form validation failed"}'::jsonb,
  now() - interval '30 minutes',
  NULL,
  false
),
(
  gen_random_uuid(),
  'performance_degradation',
  'low',
  'Database Query Slow',
  'Database query performance degraded for marketplace search',
  'production',
  '{"queryTime": 3500, "query": "marketplace_search", "threshold": 2000}'::jsonb,
  now() - interval '4 hours',
  now() - interval '3 hours',
  true
);

-- Insert sample test results for the test runs
INSERT INTO synthetic_test_results (
  id,
  test_run_id,
  scenario_id,
  status,
  started_at,
  completed_at,
  execution_time_ms,
  steps_executed,
  steps_passed,
  steps_failed,
  step_results,
  performance_metrics,
  error_message
) VALUES
(
  gen_random_uuid(),
  (SELECT id FROM synthetic_test_runs WHERE status = 'completed' LIMIT 1),
  (SELECT id FROM synthetic_test_scenarios WHERE name = 'Customer Registration Journey' LIMIT 1),
  'passed',
  now() - interval '2 hours',
  now() - interval '1 hour 58 minutes',
  125000,
  8,
  8,
  0,
  '[
    {"step": 1, "action": "navigate", "status": "passed", "duration": 1200, "screenshot": "step1.png"},
    {"step": 2, "action": "fillForm", "status": "passed", "duration": 300, "screenshot": "step2.png"},
    {"step": 3, "action": "click", "status": "passed", "duration": 450, "screenshot": "step3.png"}
  ]'::jsonb,
  '{"loadTime": 2800, "renderTime": 1200, "networkRequests": 15, "errorCount": 0}'::jsonb,
  NULL
),
(
  gen_random_uuid(),
  (SELECT id FROM synthetic_test_runs WHERE status = 'completed' LIMIT 1),
  (SELECT id FROM synthetic_test_scenarios WHERE name = 'Admin Operations Workflow' LIMIT 1),
  'failed',
  now() - interval '2 hours',
  now() - interval '1 hour 57 minutes',
  8500,
  7,
  6,
  1,
  '[
    {"step": 1, "action": "navigate", "status": "passed", "duration": 1200},
    {"step": 2, "action": "fillForm", "status": "passed", "duration": 300},
    {"step": 3, "action": "click", "status": "passed", "duration": 450},
    {"step": 4, "action": "navigate", "status": "passed", "duration": 1100},
    {"step": 5, "action": "click", "status": "passed", "duration": 650},
    {"step": 6, "action": "navigate", "status": "passed", "duration": 800},
    {"step": 7, "action": "waitFor", "status": "failed", "duration": 4000, "error": "Element .monitoring-dashboard not found within timeout"}
  ]'::jsonb,
  '{"loadTime": 3200, "renderTime": 1500, "networkRequests": 22, "errorCount": 1}'::jsonb,
  'Monitoring dashboard element not found'
);