-- Add a UNIQUE constraint to profiles.user_id to allow it to be a foreign key target
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conname = 'profiles_user_id_key' AND contype = 'u'
    ) THEN
        ALTER TABLE public.profiles
        ADD CONSTRAINT profiles_user_id_key UNIQUE (user_id);
    END IF;
END;
$$;

-- Add foreign key from patients.user_id to profiles.user_id
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conname = 'patients_user_id_fkey'
    ) THEN
        ALTER TABLE public.patients
        ADD CONSTRAINT patients_user_id_fkey FOREIGN KEY (user_id)
        REFERENCES public.profiles(user_id) ON DELETE CASCADE;
    END IF;
END;
$$;

-- Add foreign key from doctors.user_id to profiles.user_id
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conname = 'doctors_user_id_fkey'
    ) THEN
        ALTER TABLE public.doctors
        ADD CONSTRAINT doctors_user_id_fkey FOREIGN KEY (user_id)
        REFERENCES public.profiles(user_id) ON DELETE CASCADE;
    END IF;
END;
$$;

-- Create the messages table
CREATE TABLE IF NOT EXISTS public.messages (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    created_at timestamptz NOT NULL DEFAULT now(),
    content text NOT NULL,
    sender_type text NOT NULL, -- 'doctor' or 'patient'
    sender_id uuid NOT NULL
);

-- Add patient_id column to messages table if it doesn't exist
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'messages' AND column_name = 'patient_id'
    ) THEN
        ALTER TABLE public.messages ADD COLUMN patient_id uuid NOT NULL;
    END IF;
END;
$$;

-- Add sender_type column to messages table if it doesn't exist
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'messages' AND column_name = 'sender_type'
    ) THEN
        ALTER TABLE public.messages ADD COLUMN sender_type text NOT NULL;
    END IF;
END;
$$;

-- Add foreign key to messages table if it doesn't exist
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conname = 'messages_patient_id_fkey'
    ) THEN
        ALTER TABLE public.messages
        ADD CONSTRAINT messages_patient_id_fkey FOREIGN KEY (patient_id)
        REFERENCES public.patients(id) ON DELETE CASCADE;
    END IF;
END;
$$;

-- Add indexes for performance
CREATE INDEX IF NOT EXISTS messages_patient_id_idx ON public.messages(patient_id);
CREATE INDEX IF NOT EXISTS messages_sender_id_idx ON public.messages(sender_id);

-- Enable Row Level Security
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;

-- Granting all access to authenticated users
-- The application logic should handle the filtering of messages
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policy WHERE polname = 'Allow all access to authenticated users' AND polrelid = 'public.messages'::regclass
    ) THEN
        CREATE POLICY "Allow all access to authenticated users"
        ON public.messages
        FOR ALL
        TO authenticated
        USING (true)
        WITH CHECK (true);
    END IF;
END;
$$;

-- Function to get patient and doctor info for the chat screen
CREATE OR REPLACE FUNCTION get_chat_context(p_patient_id uuid, d_user_id uuid)
RETURNS json
LANGUAGE plpgsql
AS $$
DECLARE
    patient_info json;
    doctor_info json;
BEGIN
    -- Get patient info
    SELECT json_build_object(
        'id', p.id,
        'profiles', json_build_object(
            'full_name', pr.full_name
        )
    )
    INTO patient_info
    FROM public.patients p
    JOIN public.profiles pr ON p.user_id = pr.user_id
    WHERE p.id = p_patient_id;

    -- Get doctor info
    SELECT json_build_object(
        'id', d.id,
        'profiles', json_build_object(
            'full_name', pr.full_name
        )
    )
    INTO doctor_info
    FROM public.doctors d
    JOIN public.profiles pr ON d.user_id = pr.user_id
    WHERE d.user_id = d_user_id;

    RETURN json_build_object(
        'patient', patient_info,
        'doctor', doctor_info
    );
END;
$$;
