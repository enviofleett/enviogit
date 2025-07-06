-- Insert sample marketplace data

-- Insert sample service categories
INSERT INTO public.service_categories (name, description, is_active) VALUES 
('Vehicle Maintenance', 'Regular maintenance and repair services', true),
('Car Wash', 'Professional car cleaning services', true),
('Tyre Services', 'Tyre replacement, repair and balancing', true),
('Diagnostics', 'Vehicle diagnostic and inspection services', true),
('Fuel Services', 'Fuel delivery and related services', true),
('Insurance', 'Vehicle insurance and related services', true);

-- Note: Sample merchants and offerings would need to be created through the application
-- since they require actual user accounts. This provides the foundation categories.