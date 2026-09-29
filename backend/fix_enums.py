from app.core.database import engine
from sqlalchemy import text

def fix_enums():
    with engine.begin() as conn:
        # Check validationstatus labels
        res = conn.execute(text("SELECT enumlabel FROM pg_enum JOIN pg_type ON pg_enum.enumtypid = pg_type.oid WHERE typname = 'validationstatus';"))
        val_labels = [r[0] for r in res]
        print("Existing validationstatus labels:", val_labels)

        for val in ['PENDING', 'PROCESSING', 'READY', 'VALID', 'WARNING', 'INVALID', 'FAILED']:
            if val not in val_labels:
                print(f"Adding {val} to validationstatus enum...")
                try:
                    conn.execute(text(f"ALTER TYPE validationstatus ADD VALUE '{val}';"))
                except Exception as e:
                    print(f"Error adding {val}: {e}")

        # Check documentstatus labels
        res_doc = conn.execute(text("SELECT enumlabel FROM pg_enum JOIN pg_type ON pg_enum.enumtypid = pg_type.oid WHERE typname = 'documentstatus';"))
        doc_labels = [r[0] for r in res_doc]
        print("Existing documentstatus labels:", doc_labels)

        for val in ['ACTIVE', 'ARCHIVED', 'REPLACED', 'DELETED']:
            if val not in doc_labels:
                print(f"Adding {val} to documentstatus enum...")
                try:
                    conn.execute(text(f"ALTER TYPE documentstatus ADD VALUE '{val}';"))
                except Exception as e:
                    print(f"Error adding {val}: {e}")

        # Check documentusagestatus labels
        res_usage = conn.execute(text("SELECT enumlabel FROM pg_enum JOIN pg_type ON pg_enum.enumtypid = pg_type.oid WHERE typname = 'documentusagestatus';"))
        usage_labels = [r[0] for r in res_usage]
        print("Existing documentusagestatus labels:", usage_labels)

        for val in ['NOT_USED', 'SELECTED', 'SYNCING', 'SYNCED', 'UNDER_REVIEW', 'ACCEPTED', 'REJECTED', 'NEEDS_CORRECTION']:
            if val not in usage_labels:
                print(f"Adding {val} to documentusagestatus enum...")
                try:
                    conn.execute(text(f"ALTER TYPE documentusagestatus ADD VALUE '{val}';"))
                except Exception as e:
                    print(f"Error adding {val}: {e}")

    print("Enums verified and updated successfully.")

if __name__ == "__main__":
    fix_enums()
