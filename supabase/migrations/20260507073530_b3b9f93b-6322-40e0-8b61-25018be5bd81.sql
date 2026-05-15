
-- Roles
CREATE TYPE public.app_role AS ENUM ('admin', 'host', 'checker', 'attendee');
CREATE TYPE public.event_visibility AS ENUM ('public', 'unlisted');
CREATE TYPE public.event_status AS ENUM ('draft', 'published');
CREATE TYPE public.rsvp_status AS ENUM ('going', 'waitlist', 'cancelled');

-- Profiles
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  display_name TEXT,
  avatar_url TEXT,
  bio TEXT,
  is_host BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role public.app_role NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, role)
);
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role public.app_role)
RETURNS BOOLEAN LANGUAGE SQL STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role)
$$;

-- Events
CREATE TABLE public.events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  host_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  slug TEXT UNIQUE,
  description TEXT,
  cover_image_url TEXT,
  location TEXT,
  starts_at TIMESTAMPTZ NOT NULL,
  ends_at TIMESTAMPTZ NOT NULL,
  capacity INTEGER NOT NULL DEFAULT 50,
  visibility public.event_visibility NOT NULL DEFAULT 'public',
  status public.event_status NOT NULL DEFAULT 'draft',
  is_paid BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.events ENABLE ROW LEVEL SECURITY;

-- RSVPs
CREATE TABLE public.rsvps (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id UUID NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  status public.rsvp_status NOT NULL DEFAULT 'going',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (event_id, user_id)
);
ALTER TABLE public.rsvps ENABLE ROW LEVEL SECURITY;

-- Tickets
CREATE TABLE public.tickets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  rsvp_id UUID NOT NULL UNIQUE REFERENCES public.rsvps(id) ON DELETE CASCADE,
  event_id UUID NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  qr_token TEXT NOT NULL UNIQUE DEFAULT encode(gen_random_bytes(16), 'hex'),
  checked_in_at TIMESTAMPTZ,
  checked_in_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.tickets ENABLE ROW LEVEL SECURITY;

-- updated_at trigger
CREATE OR REPLACE FUNCTION public.tg_set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END $$;

CREATE TRIGGER profiles_updated_at BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();
CREATE TRIGGER events_updated_at BEFORE UPDATE ON public.events
  FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

-- Auto-create profile + attendee role on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.profiles (id, display_name)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'display_name', split_part(NEW.email, '@', 1)));
  INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'attendee');
  RETURN NEW;
END $$;

CREATE TRIGGER on_auth_user_created AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Auto-create ticket when RSVP is going
CREATE OR REPLACE FUNCTION public.handle_new_rsvp()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.status = 'going' THEN
    INSERT INTO public.tickets (rsvp_id, event_id, user_id)
    VALUES (NEW.id, NEW.event_id, NEW.user_id)
    ON CONFLICT (rsvp_id) DO NOTHING;
  END IF;
  RETURN NEW;
END $$;

CREATE TRIGGER on_rsvp_created AFTER INSERT ON public.rsvps
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_rsvp();

-- RLS POLICIES

-- profiles: anyone can read, owner can update
CREATE POLICY "profiles readable" ON public.profiles FOR SELECT USING (true);
CREATE POLICY "profiles self update" ON public.profiles FOR UPDATE USING (auth.uid() = id);
CREATE POLICY "profiles self insert" ON public.profiles FOR INSERT WITH CHECK (auth.uid() = id);

-- user_roles: user can read own roles, admin can read all
CREATE POLICY "roles self read" ON public.user_roles FOR SELECT USING (auth.uid() = user_id OR public.has_role(auth.uid(), 'admin'));
CREATE POLICY "roles admin write" ON public.user_roles FOR ALL USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- events
CREATE POLICY "events public read" ON public.events FOR SELECT USING (
  status = 'published' OR host_id = auth.uid()
);
CREATE POLICY "events host insert" ON public.events FOR INSERT WITH CHECK (
  auth.uid() = host_id AND public.has_role(auth.uid(), 'host')
);
CREATE POLICY "events host update" ON public.events FOR UPDATE USING (auth.uid() = host_id);
CREATE POLICY "events host delete" ON public.events FOR DELETE USING (auth.uid() = host_id);

-- rsvps
CREATE POLICY "rsvps owner read" ON public.rsvps FOR SELECT USING (
  auth.uid() = user_id OR EXISTS (SELECT 1 FROM public.events e WHERE e.id = event_id AND e.host_id = auth.uid())
);
CREATE POLICY "rsvps insert self" ON public.rsvps FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "rsvps update self" ON public.rsvps FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "rsvps delete self" ON public.rsvps FOR DELETE USING (auth.uid() = user_id);

-- tickets
CREATE POLICY "tickets owner read" ON public.tickets FOR SELECT USING (
  auth.uid() = user_id
  OR EXISTS (SELECT 1 FROM public.events e WHERE e.id = event_id AND e.host_id = auth.uid())
  OR public.has_role(auth.uid(), 'checker')
);
CREATE POLICY "tickets check-in" ON public.tickets FOR UPDATE USING (
  public.has_role(auth.uid(), 'checker')
  OR EXISTS (SELECT 1 FROM public.events e WHERE e.id = event_id AND e.host_id = auth.uid())
);
