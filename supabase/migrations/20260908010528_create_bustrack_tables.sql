/*
# Create BusTrack schema — school bus tracking app

Creates 10 tables matching the original Base44 entity definitions,
plus a profiles table that extends Supabase auth.users with app-specific
fields (role, school, bus assignment, notification prefs, admin verification).

## Tables

1. profiles — extends auth.users with app_role, school_name, bus_id, etc.
2. buses — bus fleet info, GPS location, status, driver assignment
3. stops — ordered stops on a bus route with coordinates and times
4. students — student roster tied to a bus and school
5. student_stops — which stop each student gets on/off at
6. broadcasts — admin/driver announcements to parents/drivers
7. chat_messages — per-bus chat between parents and drivers
8. parent_links — links parents to specific students
9. safety_issues — driver-reported safety concerns
10. schedule_exceptions — date-specific schedule overrides
11. driver_codes — one-time codes for drivers to claim a bus

## Security

All tables have RLS enabled. Most tables are scoped to the same school
as the authenticated user via profiles.school_name. Admins get full CRUD
within their school. Drivers can update bus/stop data for their assigned
bus. Parents can read data for their child's bus and send chat messages.
*/

-- ============================================
-- PROFILES (extends auth.users)
-- ============================================
CREATE TABLE IF NOT EXISTS profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email text,
  full_name text,
  app_role text DEFAULT NULL CHECK (app_role IN ('admin', 'driver', 'parent')),
  school_name text,
  bus_id text,
  stop_id text,
  child_name text,
  phone text,
  notify_proximity boolean DEFAULT true,
  notify_approaching boolean DEFAULT true,
  notify_arrived boolean DEFAULT true,
  notify_broadcasts boolean DEFAULT true,
  proximity_radius numeric DEFAULT 0.5,
  map_type text DEFAULT 'street' CHECK (map_type IN ('street', 'satellite')),
  map_follow boolean DEFAULT true,
  is_main_admin boolean DEFAULT false,
  admin_verified boolean DEFAULT false,
  admin_document_url text,
  admin_verification_status text DEFAULT 'pending' CHECK (admin_verification_status IN ('pending', 'passed', 'flagged', 'failed')),
  admin_verification_score numeric,
  admin_verification_summary text,
  admin_verification_details text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "profiles_select_own" ON profiles;
CREATE POLICY "profiles_select_own" ON profiles FOR SELECT
  TO authenticated USING (auth.uid() = id);

DROP POLICY IF EXISTS "profiles_insert_own" ON profiles;
CREATE POLICY "profiles_insert_own" ON profiles FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = id);

DROP POLICY IF EXISTS "profiles_update_own" ON profiles;
CREATE POLICY "profiles_update_own" ON profiles FOR UPDATE
  TO authenticated USING (auth.uid() = id) WITH CHECK (auth.uid() = id);

-- ============================================
-- BUSES
-- ============================================
CREATE TABLE IF NOT EXISTS buses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  bus_number text NOT NULL,
  school_name text NOT NULL,
  school_district text,
  current_lat numeric,
  current_lng numeric,
  status text DEFAULT 'inactive' CHECK (status IN ('inactive', 'active', 'on_route', 'at_school')),
  assigned_driver_id text,
  active_driver_id text,
  active_driver_type text DEFAULT 'regular' CHECK (active_driver_type IN ('regular', 'sub')),
  claim_start_time text,
  current_stop_index integer DEFAULT 0,
  route_started boolean DEFAULT false,
  scheduled_departure text,
  last_delay_minutes numeric,
  route_start_time text,
  route_end_time text,
  join_code text,
  trip_direction text DEFAULT 'to_school' CHECK (trip_direction IN ('to_school', 'from_school')),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE buses ENABLE ROW LEVEL SECURITY;

-- All authenticated users can read buses for their school
DROP POLICY IF EXISTS "buses_select_school" ON buses;
CREATE POLICY "buses_select_school" ON buses FOR SELECT
  TO authenticated USING (
    school_name = (SELECT school_name FROM profiles WHERE id = auth.uid())
  );

-- Admins (of same school) can create buses
DROP POLICY IF EXISTS "buses_insert_admin" ON buses;
CREATE POLICY "buses_insert_admin" ON buses FOR INSERT
  TO authenticated WITH CHECK (
    school_name = (SELECT school_name FROM profiles WHERE id = auth.uid())
    AND (SELECT app_role FROM profiles WHERE id = auth.uid()) = 'admin'
  );

-- Admins and assigned drivers can update buses
DROP POLICY IF EXISTS "buses_update_admin_driver" ON buses;
CREATE POLICY "buses_update_admin_driver" ON buses FOR UPDATE
  TO authenticated USING (
    (SELECT app_role FROM profiles WHERE id = auth.uid()) = 'admin'
    OR (SELECT app_role FROM profiles WHERE id = auth.uid()) = 'driver'
  ) WITH CHECK (
    (SELECT app_role FROM profiles WHERE id = auth.uid()) = 'admin'
    OR (SELECT app_role FROM profiles WHERE id = auth.uid()) = 'driver'
  );

-- Admins can delete buses in their school
DROP POLICY IF EXISTS "buses_delete_admin" ON buses;
CREATE POLICY "buses_delete_admin" ON buses FOR DELETE
  TO authenticated USING (
    school_name = (SELECT school_name FROM profiles WHERE id = auth.uid())
    AND (SELECT app_role FROM profiles WHERE id = auth.uid()) = 'admin'
  );

-- ============================================
-- STOPS
-- ============================================
CREATE TABLE IF NOT EXISTS stops (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  bus_id text NOT NULL,
  name text NOT NULL,
  address text,
  latitude numeric NOT NULL,
  longitude numeric NOT NULL,
  stop_order integer NOT NULL,
  scheduled_time text,
  actual_arrival text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE stops ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "stops_select_school" ON stops;
CREATE POLICY "stops_select_school" ON stops FOR SELECT
  TO authenticated USING (
    EXISTS (
      SELECT 1 FROM buses
      WHERE buses.id::text = stops.bus_id
      AND buses.school_name = (SELECT school_name FROM profiles WHERE id = auth.uid())
    )
  );

DROP POLICY IF EXISTS "stops_insert_admin" ON stops;
CREATE POLICY "stops_insert_admin" ON stops FOR INSERT
  TO authenticated WITH CHECK (
    (SELECT app_role FROM profiles WHERE id = auth.uid()) = 'admin'
  );

DROP POLICY IF EXISTS "stops_update_admin_driver" ON stops;
CREATE POLICY "stops_update_admin_driver" ON stops FOR UPDATE
  TO authenticated USING (
    (SELECT app_role FROM profiles WHERE id = auth.uid()) = 'admin'
    OR (SELECT app_role FROM profiles WHERE id = auth.uid()) = 'driver'
  ) WITH CHECK (
    (SELECT app_role FROM profiles WHERE id = auth.uid()) = 'admin'
    OR (SELECT app_role FROM profiles WHERE id = auth.uid()) = 'driver'
  );

DROP POLICY IF EXISTS "stops_delete_admin" ON stops;
CREATE POLICY "stops_delete_admin" ON stops FOR DELETE
  TO authenticated USING (
    (SELECT app_role FROM profiles WHERE id = auth.uid()) = 'admin'
  );

-- ============================================
-- STUDENTS
-- ============================================
CREATE TABLE IF NOT EXISTS students (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  first_name text NOT NULL,
  last_name text NOT NULL,
  bus_id text NOT NULL,
  school_name text NOT NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE students ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "students_select_school" ON students;
CREATE POLICY "students_select_school" ON students FOR SELECT
  TO authenticated USING (
    school_name = (SELECT school_name FROM profiles WHERE id = auth.uid())
    AND (SELECT app_role FROM profiles WHERE id = auth.uid()) = 'admin'
  );

DROP POLICY IF EXISTS "students_insert_admin" ON students;
CREATE POLICY "students_insert_admin" ON students FOR INSERT
  TO authenticated WITH CHECK (
    school_name = (SELECT school_name FROM profiles WHERE id = auth.uid())
    AND (SELECT app_role FROM profiles WHERE id = auth.uid()) = 'admin'
  );

DROP POLICY IF EXISTS "students_update_admin" ON students;
CREATE POLICY "students_update_admin" ON students FOR UPDATE
  TO authenticated USING (
    school_name = (SELECT school_name FROM profiles WHERE id = auth.uid())
    AND (SELECT app_role FROM profiles WHERE id = auth.uid()) = 'admin'
  ) WITH CHECK (
    school_name = (SELECT school_name FROM profiles WHERE id = auth.uid())
    AND (SELECT app_role FROM profiles WHERE id = auth.uid()) = 'admin'
  );

DROP POLICY IF EXISTS "students_delete_admin" ON students;
CREATE POLICY "students_delete_admin" ON students FOR DELETE
  TO authenticated USING (
    school_name = (SELECT school_name FROM profiles WHERE id = auth.uid())
    AND (SELECT app_role FROM profiles WHERE id = auth.uid()) = 'admin'
  );

-- ============================================
-- STUDENT_STOPS
-- ============================================
CREATE TABLE IF NOT EXISTS student_stops (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id text NOT NULL,
  stop_id text NOT NULL,
  bus_id text NOT NULL,
  school_name text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE student_stops ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "student_stops_select_school" ON student_stops;
CREATE POLICY "student_stops_select_school" ON student_stops FOR SELECT
  TO authenticated USING (
    (SELECT app_role FROM profiles WHERE id = auth.uid()) = 'admin'
  );

DROP POLICY IF EXISTS "student_stops_insert_admin" ON student_stops;
CREATE POLICY "student_stops_insert_admin" ON student_stops FOR INSERT
  TO authenticated WITH CHECK (
    (SELECT app_role FROM profiles WHERE id = auth.uid()) = 'admin'
  );

DROP POLICY IF EXISTS "student_stops_update_admin" ON student_stops;
CREATE POLICY "student_stops_update_admin" ON student_stops FOR UPDATE
  TO authenticated USING (
    (SELECT app_role FROM profiles WHERE id = auth.uid()) = 'admin'
  ) WITH CHECK (
    (SELECT app_role FROM profiles WHERE id = auth.uid()) = 'admin'
  );

DROP POLICY IF EXISTS "student_stops_delete_admin" ON student_stops;
CREATE POLICY "student_stops_delete_admin" ON student_stops FOR DELETE
  TO authenticated USING (
    (SELECT app_role FROM profiles WHERE id = auth.uid()) = 'admin'
  );

-- ============================================
-- BROADCASTS
-- ============================================
CREATE TABLE IF NOT EXISTS broadcasts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sender_name text NOT NULL,
  sender_role text DEFAULT 'admin' CHECK (sender_role IN ('admin', 'driver')),
  school_name text NOT NULL,
  title text,
  message text NOT NULL,
  audience text DEFAULT 'all' CHECK (audience IN ('all', 'all_parents', 'all_drivers', 'bus_specific')),
  target_bus_id text,
  target_bus_number text,
  priority text DEFAULT 'normal' CHECK (priority IN ('normal', 'urgent')),
  created_by_id text,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE broadcasts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "broadcasts_select_school" ON broadcasts;
CREATE POLICY "broadcasts_select_school" ON broadcasts FOR SELECT
  TO authenticated USING (
    school_name = (SELECT school_name FROM profiles WHERE id = auth.uid())
  );

DROP POLICY IF EXISTS "broadcasts_insert_admin_driver" ON broadcasts;
CREATE POLICY "broadcasts_insert_admin_driver" ON broadcasts FOR INSERT
  TO authenticated WITH CHECK (
    school_name = (SELECT school_name FROM profiles WHERE id = auth.uid())
    AND (SELECT app_role FROM profiles WHERE id = auth.uid()) IN ('admin', 'driver')
  );

DROP POLICY IF EXISTS "broadcasts_update_creator_admin" ON broadcasts;
CREATE POLICY "broadcasts_update_creator_admin" ON broadcasts FOR UPDATE
  TO authenticated USING (
    created_by_id = auth.uid()::text
    OR (SELECT app_role FROM profiles WHERE id = auth.uid()) = 'admin'
  ) WITH CHECK (
    created_by_id = auth.uid()::text
    OR (SELECT app_role FROM profiles WHERE id = auth.uid()) = 'admin'
  );

DROP POLICY IF EXISTS "broadcasts_delete_creator_admin" ON broadcasts;
CREATE POLICY "broadcasts_delete_creator_admin" ON broadcasts FOR DELETE
  TO authenticated USING (
    created_by_id = auth.uid()::text
    OR (SELECT app_role FROM profiles WHERE id = auth.uid()) = 'admin'
  );

-- ============================================
-- CHAT_MESSAGES
-- ============================================
CREATE TABLE IF NOT EXISTS chat_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  bus_id text NOT NULL,
  sender_id text NOT NULL,
  sender_name text NOT NULL,
  sender_role text NOT NULL,
  message text NOT NULL,
  school_name text,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE chat_messages ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "chat_select_school" ON chat_messages;
CREATE POLICY "chat_select_school" ON chat_messages FOR SELECT
  TO authenticated USING (
    school_name = (SELECT school_name FROM profiles WHERE id = auth.uid())
  );

DROP POLICY IF EXISTS "chat_insert_school" ON chat_messages;
CREATE POLICY "chat_insert_school" ON chat_messages FOR INSERT
  TO authenticated WITH CHECK (
    school_name = (SELECT school_name FROM profiles WHERE id = auth.uid())
  );

DROP POLICY IF EXISTS "chat_delete_own" ON chat_messages;
CREATE POLICY "chat_delete_own" ON chat_messages FOR DELETE
  TO authenticated USING (
    sender_id = auth.uid()::text
  );

-- ============================================
-- PARENT_LINKS
-- ============================================
CREATE TABLE IF NOT EXISTS parent_links (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  parent_id text NOT NULL,
  student_id text,
  bus_id text,
  stop_id text,
  school_name text,
  child_name text,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE parent_links ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "parent_links_select_own" ON parent_links;
CREATE POLICY "parent_links_select_own" ON parent_links FOR SELECT
  TO authenticated USING (
    parent_id = auth.uid()::text
    OR (SELECT app_role FROM profiles WHERE id = auth.uid()) = 'admin'
  );

DROP POLICY IF EXISTS "parent_links_insert_own" ON parent_links;
CREATE POLICY "parent_links_insert_own" ON parent_links FOR INSERT
  TO authenticated WITH CHECK (
    parent_id = auth.uid()::text
  );

DROP POLICY IF EXISTS "parent_links_delete_own" ON parent_links;
CREATE POLICY "parent_links_delete_own" ON parent_links FOR DELETE
  TO authenticated USING (
    parent_id = auth.uid()::text
    OR (SELECT app_role FROM profiles WHERE id = auth.uid()) = 'admin'
  );

-- ============================================
-- SAFETY_ISSUES
-- ============================================
CREATE TABLE IF NOT EXISTS safety_issues (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  bus_id text,
  driver_id text,
  driver_name text,
  school_name text,
  category text,
  severity text DEFAULT 'medium' CHECK (severity IN ('low', 'medium', 'high')),
  description text NOT NULL,
  status text DEFAULT 'open' CHECK (status IN ('open', 'acknowledged', 'resolved')),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE safety_issues ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "safety_select_school" ON safety_issues;
CREATE POLICY "safety_select_school" ON safety_issues FOR SELECT
  TO authenticated USING (
    school_name = (SELECT school_name FROM profiles WHERE id = auth.uid())
  );

DROP POLICY IF EXISTS "safety_insert_driver" ON safety_issues;
CREATE POLICY "safety_insert_driver" ON safety_issues FOR INSERT
  TO authenticated WITH CHECK (
    (SELECT app_role FROM profiles WHERE id = auth.uid()) IN ('admin', 'driver')
  );

DROP POLICY IF EXISTS "safety_update_admin" ON safety_issues;
CREATE POLICY "safety_update_admin" ON safety_issues FOR UPDATE
  TO authenticated USING (
    (SELECT app_role FROM profiles WHERE id = auth.uid()) = 'admin'
  ) WITH CHECK (
    (SELECT app_role FROM profiles WHERE id = auth.uid()) = 'admin'
  );

-- ============================================
-- SCHEDULE_EXCEPTIONS
-- ============================================
CREATE TABLE IF NOT EXISTS schedule_exceptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  school_name text NOT NULL,
  bus_id text,
  exception_date date NOT NULL,
  exception_type text CHECK (exception_type IN ('no_service', 'delayed', 'early', 'canceled')),
  description text,
  delay_minutes integer,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE schedule_exceptions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "exceptions_select_school" ON schedule_exceptions;
CREATE POLICY "exceptions_select_school" ON schedule_exceptions FOR SELECT
  TO authenticated USING (
    school_name = (SELECT school_name FROM profiles WHERE id = auth.uid())
  );

DROP POLICY IF EXISTS "exceptions_insert_admin" ON schedule_exceptions;
CREATE POLICY "exceptions_insert_admin" ON schedule_exceptions FOR INSERT
  TO authenticated WITH CHECK (
    (SELECT app_role FROM profiles WHERE id = auth.uid()) = 'admin'
  );

DROP POLICY IF EXISTS "exceptions_delete_admin" ON schedule_exceptions;
CREATE POLICY "exceptions_delete_admin" ON schedule_exceptions FOR DELETE
  TO authenticated USING (
    (SELECT app_role FROM profiles WHERE id = auth.uid()) = 'admin'
  );

-- ============================================
-- DRIVER_CODES
-- ============================================
CREATE TABLE IF NOT EXISTS driver_codes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  bus_id text NOT NULL,
  driver_id text,
  code text NOT NULL,
  used boolean DEFAULT false,
  expires_at timestamptz,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE driver_codes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "driver_codes_select_admin" ON driver_codes;
CREATE POLICY "driver_codes_select_admin" ON driver_codes FOR SELECT
  TO authenticated USING (
    (SELECT app_role FROM profiles WHERE id = auth.uid()) = 'admin'
  );

DROP POLICY IF EXISTS "driver_codes_insert_admin" ON driver_codes;
CREATE POLICY "driver_codes_insert_admin" ON driver_codes FOR INSERT
  TO authenticated WITH CHECK (
    (SELECT app_role FROM profiles WHERE id = auth.uid()) = 'admin'
  );

DROP POLICY IF EXISTS "driver_codes_update_admin" ON driver_codes;
CREATE POLICY "driver_codes_update_admin" ON driver_codes FOR UPDATE
  TO authenticated USING (
    (SELECT app_role FROM profiles WHERE id = auth.uid()) = 'admin'
  ) WITH CHECK (
    (SELECT app_role FROM profiles WHERE id = auth.uid()) = 'admin'
  );

DROP POLICY IF EXISTS "driver_codes_delete_admin" ON driver_codes;
CREATE POLICY "driver_codes_delete_admin" ON driver_codes FOR DELETE
  TO authenticated USING (
    (SELECT app_role FROM profiles WHERE id = auth.uid()) = 'admin'
  );

-- ============================================
-- INDEXES
-- ============================================
CREATE INDEX IF NOT EXISTS idx_buses_school ON buses(school_name);
CREATE INDEX IF NOT EXISTS idx_stops_bus_id ON stops(bus_id);
CREATE INDEX IF NOT EXISTS idx_students_bus_id ON students(bus_id);
CREATE INDEX IF NOT EXISTS idx_students_school ON students(school_name);
CREATE INDEX IF NOT EXISTS idx_broadcasts_school ON broadcasts(school_name);
CREATE INDEX IF NOT EXISTS idx_chat_bus_id ON chat_messages(bus_id);
CREATE INDEX IF NOT EXISTS idx_parent_links_parent ON parent_links(parent_id);
CREATE INDEX IF NOT EXISTS idx_safety_school ON safety_issues(school_name);
CREATE INDEX IF NOT EXISTS idx_exceptions_school ON schedule_exceptions(school_name);

-- ============================================
-- TRIGGER: auto-create profile on signup
-- ============================================
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name)
  VALUES (NEW.id, NEW.email, COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'name', ''));
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
