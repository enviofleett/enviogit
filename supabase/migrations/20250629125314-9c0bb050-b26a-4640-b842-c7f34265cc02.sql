
-- Create GPS51 users table
CREATE TABLE public.users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  gps51_username text UNIQUE NOT NULL,
  password_hash text NOT NULL,
  email text,
  phone text,
  nickname text,
  user_type smallint,
  created_at timestamp with time zone DEFAULT now()
);

-- Create GPS51 devices table
CREATE TABLE public.devices (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  device_id text UNIQUE NOT NULL, -- GPS51's deviceid
  device_name text,
  gps51_group_id text,
  assigned_user_id uuid REFERENCES public.users(id),
  last_seen_at timestamp with time zone,
  created_at timestamp with time zone DEFAULT now()
);

-- Create GPS51 positions table
CREATE TABLE public.positions (
  id bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
  device_id text REFERENCES public.devices(device_id),
  latitude numeric NOT NULL,
  longitude numeric NOT NULL,
  timestamp timestamp with time zone NOT NULL,
  speed_kph numeric,
  heading smallint,
  ignition_on boolean DEFAULT false,
  battery_voltage numeric,
  raw_data jsonb,
  created_at timestamp with time zone DEFAULT now()
);

-- Enable Row Level Security
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.devices ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.positions ENABLE ROW LEVEL SECURITY;

-- Create RLS policies for users table
CREATE POLICY "Users can view their own data" ON public.users
  FOR SELECT USING (auth.uid() = id);

CREATE POLICY "Users can update their own data" ON public.users
  FOR UPDATE USING (auth.uid() = id);

-- Create RLS policies for devices table
CREATE POLICY "Users can view their assigned devices" ON public.devices
  FOR SELECT USING (assigned_user_id = auth.uid());

CREATE POLICY "Users can update their assigned devices" ON public.devices
  FOR UPDATE USING (assigned_user_id = auth.uid());

-- Create RLS policies for positions table
CREATE POLICY "Users can view positions of their devices" ON public.positions
  FOR SELECT USING (
    device_id IN (
      SELECT device_id FROM public.devices WHERE assigned_user_id = auth.uid()
    )
  );

-- Create indexes for performance
CREATE INDEX idx_devices_device_id ON public.devices(device_id);
CREATE INDEX idx_devices_assigned_user ON public.devices(assigned_user_id);
CREATE INDEX idx_positions_device_id ON public.positions(device_id);
CREATE INDEX idx_positions_timestamp ON public.positions(timestamp DESC);
CREATE INDEX idx_positions_device_timestamp ON public.positions(device_id, timestamp DESC);

-- Create shared_tracks table for GPS51 sharing functionality
CREATE TABLE public.shared_tracks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  device_id text REFERENCES public.devices(device_id),
  generated_by_user_id uuid REFERENCES public.users(id),
  sharing_interval_minutes integer,
  sharing_duration_minutes integer,
  shared_url text,
  expires_at timestamp with time zone,
  created_at timestamp with time zone DEFAULT now()
);

-- Create video_records table for GPS51 video functionality
CREATE TABLE public.video_records (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  device_id text REFERENCES public.devices(device_id),
  channel smallint,
  start_time timestamp with time zone,
  end_time timestamp with time zone,
  media_type smallint,
  storage_type smallint,
  gps51_record_id text,
  created_at timestamp with time zone DEFAULT now()
);

-- Enable RLS for additional tables
ALTER TABLE public.shared_tracks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.video_records ENABLE ROW LEVEL SECURITY;

-- Create RLS policies for shared_tracks
CREATE POLICY "Users can view their shared tracks" ON public.shared_tracks
  FOR SELECT USING (generated_by_user_id = auth.uid());

CREATE POLICY "Users can create their shared tracks" ON public.shared_tracks
  FOR INSERT WITH CHECK (generated_by_user_id = auth.uid());

-- Create RLS policies for video_records
CREATE POLICY "Users can view their device video records" ON public.video_records
  FOR SELECT USING (
    device_id IN (
      SELECT device_id FROM public.devices WHERE assigned_user_id = auth.uid()
    )
  );

-- Create indexes for additional tables
CREATE INDEX idx_shared_tracks_device_id ON public.shared_tracks(device_id);
CREATE INDEX idx_shared_tracks_user_id ON public.shared_tracks(generated_by_user_id);
CREATE INDEX idx_video_records_device_id ON public.video_records(device_id);
CREATE INDEX idx_video_records_time ON public.video_records(start_time DESC);
