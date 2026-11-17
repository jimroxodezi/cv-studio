ALTER TABLE "variants" ADD COLUMN "section_ids" jsonb;
ALTER TABLE "variants" ADD COLUMN "entry_ids" jsonb;

UPDATE "variants" SET
  "section_ids" = COALESCE(
    (
      SELECT jsonb_agg(elem)
      FROM jsonb_array_elements_text("section_order") AS elem
      WHERE elem <> 'summary'
    ),
    '[]'::jsonb
  ),
  "entry_ids" = COALESCE("skill_group_ids", '[]'::jsonb)
    || COALESCE("experience_ids", '[]'::jsonb)
    || COALESCE("project_ids", '[]'::jsonb)
    || COALESCE("education_ids", '[]'::jsonb);

ALTER TABLE "variants" ALTER COLUMN "section_ids" SET NOT NULL;
ALTER TABLE "variants" ALTER COLUMN "entry_ids" SET NOT NULL;

ALTER TABLE "variants" DROP COLUMN "section_order";
ALTER TABLE "variants" DROP COLUMN "skill_group_ids";
ALTER TABLE "variants" DROP COLUMN "experience_ids";
ALTER TABLE "variants" DROP COLUMN "project_ids";
ALTER TABLE "variants" DROP COLUMN "education_ids";
