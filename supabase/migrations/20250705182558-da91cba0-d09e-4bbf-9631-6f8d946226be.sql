-- Email Templates Table
CREATE TABLE email_templates (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  subject_template TEXT NOT NULL,
  body_template TEXT NOT NULL,
  template_type TEXT NOT NULL CHECK (template_type IN ('registration', 'alert', 'report', 'notification', 'password_reset', 'account_update')),
  gps51_data_fields JSONB DEFAULT '{}',
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE email_templates ENABLE ROW LEVEL SECURITY;

-- Email templates are viewable by authenticated users
CREATE POLICY "Email templates are viewable by authenticated users" 
ON email_templates 
FOR SELECT 
USING (auth.role() = 'authenticated');

-- Only admins can manage email templates
CREATE POLICY "Admins can manage email templates" 
ON email_templates 
FOR ALL
USING (auth.jwt() ->> 'role' = 'admin');

-- Email Logs Table
CREATE TABLE email_logs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  recipient_email TEXT NOT NULL,
  template_id UUID REFERENCES email_templates(id),
  alert_id TEXT, -- Link to GPS51 alerts if applicable
  vehicle_id TEXT, -- GPS51 vehicle context
  device_id TEXT, -- GPS51 device context
  user_id UUID REFERENCES auth.users(id),
  subject TEXT NOT NULL,
  content TEXT,
  sent_at TIMESTAMP WITH TIME ZONE,
  delivery_status TEXT NOT NULL DEFAULT 'pending' CHECK (delivery_status IN ('pending', 'sent', 'delivered', 'bounced', 'failed', 'opened', 'clicked')),
  provider_used TEXT,
  provider_response JSONB DEFAULT '{}',
  error_message TEXT,
  retry_count INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE email_logs ENABLE ROW LEVEL SECURITY;

-- Users can view their own email logs
CREATE POLICY "Users can view their own email logs" 
ON email_logs 
FOR SELECT 
USING (auth.uid() = user_id);

-- System can insert email logs
CREATE POLICY "System can insert email logs" 
ON email_logs 
FOR INSERT 
WITH CHECK (true);

-- System can update email logs
CREATE POLICY "System can update email logs" 
ON email_logs 
FOR UPDATE 
USING (true);

-- Email Configurations Table
CREATE TABLE email_configurations (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  provider_name TEXT NOT NULL CHECK (provider_name IN ('sendgrid', 'mailgun', 'ses', 'smtp')),
  is_active BOOLEAN DEFAULT false,
  is_primary BOOLEAN DEFAULT false,
  configuration JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(provider_name)
);

-- Enable RLS
ALTER TABLE email_configurations ENABLE ROW LEVEL SECURITY;

-- Only admins can manage email configurations
CREATE POLICY "Admins can manage email configurations" 
ON email_configurations 
FOR ALL
USING (auth.jwt() ->> 'role' = 'admin');

-- Email Preferences Table
CREATE TABLE email_preferences (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  alert_emails BOOLEAN DEFAULT true,
  report_emails BOOLEAN DEFAULT true,
  marketing_emails BOOLEAN DEFAULT false,
  geofence_alerts BOOLEAN DEFAULT true,
  maintenance_alerts BOOLEAN DEFAULT true,
  driver_notifications BOOLEAN DEFAULT true,
  weekly_reports BOOLEAN DEFAULT false,
  monthly_reports BOOLEAN DEFAULT false,
  email_frequency TEXT DEFAULT 'immediate' CHECK (email_frequency IN ('immediate', 'daily', 'weekly', 'disabled')),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(user_id)
);

-- Enable RLS
ALTER TABLE email_preferences ENABLE ROW LEVEL SECURITY;

-- Users can manage their own email preferences
CREATE POLICY "Users can manage their own email preferences" 
ON email_preferences 
FOR ALL
USING (auth.uid() = user_id);

-- Create function to update timestamps
CREATE OR REPLACE FUNCTION update_email_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create triggers for automatic timestamp updates
CREATE TRIGGER update_email_templates_updated_at
  BEFORE UPDATE ON email_templates
  FOR EACH ROW
  EXECUTE FUNCTION update_email_updated_at_column();

CREATE TRIGGER update_email_logs_updated_at
  BEFORE UPDATE ON email_logs
  FOR EACH ROW
  EXECUTE FUNCTION update_email_updated_at_column();

CREATE TRIGGER update_email_configurations_updated_at
  BEFORE UPDATE ON email_configurations
  FOR EACH ROW
  EXECUTE FUNCTION update_email_updated_at_column();

CREATE TRIGGER update_email_preferences_updated_at
  BEFORE UPDATE ON email_preferences
  FOR EACH ROW
  EXECUTE FUNCTION update_email_updated_at_column();

-- Insert default email templates
INSERT INTO email_templates (name, subject_template, body_template, template_type, gps51_data_fields) VALUES
('welcome_email', 'Welcome to Envio Fleet Management', 
'<h1>Welcome {{user_name}}!</h1><p>Thank you for joining Envio Fleet Management. Your account is now active and ready to use.</p><p>Get started by adding your first vehicle to the system.</p>', 
'registration', '{"user_name": "string", "user_email": "string"}'),

('password_reset', 'Reset Your Envio Password', 
'<h1>Password Reset Request</h1><p>Hi {{user_name}},</p><p>Click the link below to reset your password:</p><p><a href="{{reset_link}}">Reset Password</a></p><p>If you did not request this, please ignore this email.</p>', 
'password_reset', '{"user_name": "string", "reset_link": "string"}'),

('geofence_alert', 'Geofence Alert - {{vehicle_name}}', 
'<h1>Geofence Alert</h1><p>Vehicle <strong>{{vehicle_name}}</strong> has {{violation_type}} geofence <strong>{{geofence_name}}</strong></p><p>Time: {{alert_time}}</p><p>Location: {{location}}</p>', 
'alert', '{"vehicle_name": "string", "violation_type": "string", "geofence_name": "string", "alert_time": "string", "location": "string"}'),

('maintenance_alert', 'Maintenance Due - {{vehicle_name}}', 
'<h1>Maintenance Alert</h1><p>Vehicle <strong>{{vehicle_name}}</strong> requires maintenance.</p><p>Type: {{maintenance_type}}</p><p>Due Date: {{due_date}}</p><p>Mileage: {{current_mileage}}</p>', 
'alert', '{"vehicle_name": "string", "maintenance_type": "string", "due_date": "string", "current_mileage": "string"}'),

('weekly_report', 'Weekly Fleet Report', 
'<h1>Weekly Fleet Summary</h1><p>Fleet performance for week ending {{week_ending}}:</p><ul><li>Total Vehicles: {{total_vehicles}}</li><li>Active Vehicles: {{active_vehicles}}</li><li>Total Distance: {{total_distance}} km</li><li>Alerts Generated: {{total_alerts}}</li></ul>', 
'report', '{"week_ending": "string", "total_vehicles": "number", "active_vehicles": "number", "total_distance": "number", "total_alerts": "number"}');

-- Insert default email configuration placeholders
INSERT INTO email_configurations (provider_name, is_active, configuration) VALUES
('sendgrid', false, '{"api_key": "", "from_email": "noreply@envio.com", "from_name": "Envio Fleet Management"}'),
('smtp', false, '{"host": "", "port": 587, "username": "", "password": "", "secure": false, "from_email": "noreply@envio.com", "from_name": "Envio Fleet Management"}');