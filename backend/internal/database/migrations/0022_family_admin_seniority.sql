-- NULL for existing administrators: their appointment history was not recorded.
-- Such rows retain the previous joined_at fallback instead of invented dates.
ALTER TABLE family_members ADD COLUMN admin_assigned_at timestamptz;
ALTER TABLE family_members ADD CONSTRAINT family_member_admin_timestamp
    CHECK (role = 'admin' OR admin_assigned_at IS NULL);

CREATE FUNCTION track_family_admin_assignment() RETURNS trigger AS $$
BEGIN
    IF NEW.role <> 'admin' THEN
        NEW.admin_assigned_at := NULL;
    ELSIF TG_OP = 'INSERT' THEN
        NEW.admin_assigned_at := clock_timestamp();
    ELSIF OLD.role IS DISTINCT FROM 'admin' THEN
        NEW.admin_assigned_at := clock_timestamp();
    ELSE
        -- No-op role changes and home changes must not reset seniority.
        NEW.admin_assigned_at := OLD.admin_assigned_at;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER family_admin_assignment
    BEFORE INSERT OR UPDATE ON family_members
    FOR EACH ROW EXECUTE FUNCTION track_family_admin_assignment();

CREATE OR REPLACE FUNCTION pass_family_ownership() RETURNS trigger AS $$
DECLARE
    heir uuid;
BEGIN
    IF OLD.role <> 'owner' THEN RETURN NULL; END IF;
    IF NOT EXISTS (SELECT 1 FROM families WHERE id = OLD.family_id) THEN
        RETURN NULL;
    END IF;

    SELECT user_id INTO heir
    FROM family_members
    WHERE family_id = OLD.family_id
    ORDER BY (role = 'admin') DESC,
        CASE WHEN role = 'admin' THEN coalesce(admin_assigned_at, joined_at)
             ELSE joined_at END,
        joined_at, user_id
    LIMIT 1
    FOR UPDATE;

    IF heir IS NULL THEN
        DELETE FROM families WHERE id = OLD.family_id;
    ELSE
        UPDATE family_members SET role = 'owner'
        WHERE family_id = OLD.family_id AND user_id = heir;
    END IF;
    RETURN NULL;
END;
$$ LANGUAGE plpgsql;
