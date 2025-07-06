-- Create manufacturer fuel consumption database
CREATE TABLE public.manufacturer_fuel_data (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  brand TEXT NOT NULL,
  model TEXT NOT NULL,
  year INTEGER NOT NULL,
  engine_size TEXT,
  engine_type TEXT,
  fuel_type TEXT NOT NULL DEFAULT 'petrol',
  transmission_type TEXT,
  vehicle_category TEXT,
  city_consumption NUMERIC(4,1), -- L/100km
  highway_consumption NUMERIC(4,1), -- L/100km
  combined_consumption NUMERIC(4,1), -- L/100km
  speed_impact_data JSONB DEFAULT '{}',
  historical_trends JSONB DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create fuel consumption reports table
CREATE TABLE public.fuel_consumption_reports (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  vehicle_id UUID REFERENCES public.vehicles(id),
  user_id UUID NOT NULL,
  device_id TEXT NOT NULL,
  report_period_start TIMESTAMP WITH TIME ZONE NOT NULL,
  report_period_end TIMESTAMP WITH TIME ZONE NOT NULL,
  actual_consumption NUMERIC(4,1), -- L/100km from GPS51
  manufacturer_stated_consumption NUMERIC(4,1),
  speed_adjusted_consumption NUMERIC(4,1),
  deviation_percentage NUMERIC(5,2),
  efficiency_rating TEXT CHECK (efficiency_rating IN ('optimal', 'above_expected', 'high_consumption')),
  total_distance_km NUMERIC(8,2),
  total_fuel_used_liters NUMERIC(6,2),
  average_speed NUMERIC(5,1),
  speed_distribution JSONB DEFAULT '{}',
  cost_estimate NUMERIC(8,2),
  analysis_data JSONB DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create vehicle fuel profiles for enhanced metadata
CREATE TABLE public.vehicle_fuel_profiles (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  vehicle_id UUID REFERENCES public.vehicles(id) UNIQUE,
  user_id UUID NOT NULL,
  manufacturer_data_id UUID REFERENCES public.manufacturer_fuel_data(id),
  custom_fuel_capacity NUMERIC(5,1),
  preferred_fuel_price NUMERIC(5,3),
  efficiency_target NUMERIC(4,1),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.manufacturer_fuel_data ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.fuel_consumption_reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.vehicle_fuel_profiles ENABLE ROW LEVEL SECURITY;

-- RLS Policies for manufacturer_fuel_data (public read access)
CREATE POLICY "Manufacturer fuel data is viewable by all authenticated users"
ON public.manufacturer_fuel_data FOR SELECT
USING (auth.role() = 'authenticated');

CREATE POLICY "System can manage manufacturer fuel data"
ON public.manufacturer_fuel_data FOR ALL
USING (true);

-- RLS Policies for fuel_consumption_reports
CREATE POLICY "Users can view their own fuel consumption reports"
ON public.fuel_consumption_reports FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own fuel consumption reports"
ON public.fuel_consumption_reports FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own fuel consumption reports"
ON public.fuel_consumption_reports FOR UPDATE
USING (auth.uid() = user_id);

CREATE POLICY "System can manage fuel consumption reports"
ON public.fuel_consumption_reports FOR ALL
USING (true);

-- RLS Policies for vehicle_fuel_profiles
CREATE POLICY "Users can view their own vehicle fuel profiles"
ON public.vehicle_fuel_profiles FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can manage their own vehicle fuel profiles"
ON public.vehicle_fuel_profiles FOR ALL
USING (auth.uid() = user_id);

-- Create indexes for performance
CREATE INDEX idx_manufacturer_fuel_data_lookup ON public.manufacturer_fuel_data(brand, model, year);
CREATE INDEX idx_manufacturer_fuel_data_brand ON public.manufacturer_fuel_data(brand);
CREATE INDEX idx_fuel_consumption_reports_vehicle ON public.fuel_consumption_reports(vehicle_id);
CREATE INDEX idx_fuel_consumption_reports_user ON public.fuel_consumption_reports(user_id);
CREATE INDEX idx_fuel_consumption_reports_period ON public.fuel_consumption_reports(report_period_start, report_period_end);
CREATE INDEX idx_vehicle_fuel_profiles_vehicle ON public.vehicle_fuel_profiles(vehicle_id);

-- Create function to update timestamps
CREATE OR REPLACE FUNCTION public.update_fuel_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create triggers for automatic timestamp updates
CREATE TRIGGER update_manufacturer_fuel_data_updated_at
BEFORE UPDATE ON public.manufacturer_fuel_data
FOR EACH ROW
EXECUTE FUNCTION public.update_fuel_updated_at_column();

CREATE TRIGGER update_fuel_consumption_reports_updated_at
BEFORE UPDATE ON public.fuel_consumption_reports
FOR EACH ROW
EXECUTE FUNCTION public.update_fuel_updated_at_column();

CREATE TRIGGER update_vehicle_fuel_profiles_updated_at
BEFORE UPDATE ON public.vehicle_fuel_profiles
FOR EACH ROW
EXECUTE FUNCTION public.update_fuel_updated_at_column();