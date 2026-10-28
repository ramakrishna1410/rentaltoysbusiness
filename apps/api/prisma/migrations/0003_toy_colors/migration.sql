-- CreateEnum
CREATE TYPE "ColorType" AS ENUM ('SINGLE', 'DUAL', 'MULTI');

-- CreateEnum
CREATE TYPE "ToyColor" AS ENUM ('RED', 'ORANGE', 'YELLOW', 'GREEN', 'BLUE', 'PURPLE', 'PINK', 'BROWN', 'NATURAL_WOOD', 'BLACK', 'WHITE', 'GREY');

-- AlterTable
ALTER TABLE "Toy" ADD COLUMN     "colorType" "ColorType" NOT NULL DEFAULT 'MULTI',
ADD COLUMN     "primaryColor" "ToyColor",
ADD COLUMN     "secondaryColor" "ToyColor";


-- Best-effort mapping for toys created before structured colours: "A / B" or "A & B" becomes DUAL,
-- one known colour word becomes SINGLE, anything else stays MULTI. Review these in the admin app.
UPDATE "Toy" SET "colorType" = 'DUAL',
  "primaryColor" = (CASE lower(trim(split_part(replace("color", '&', '/'), '/', 1)))
    WHEN 'red' THEN 'RED' WHEN 'orange' THEN 'ORANGE' WHEN 'yellow' THEN 'YELLOW' WHEN 'green' THEN 'GREEN'
    WHEN 'blue' THEN 'BLUE' WHEN 'purple' THEN 'PURPLE' WHEN 'pink' THEN 'PINK' WHEN 'brown' THEN 'BROWN'
    WHEN 'natural' THEN 'NATURAL_WOOD' WHEN 'black' THEN 'BLACK' WHEN 'white' THEN 'WHITE' WHEN 'grey' THEN 'GREY' END)::"ToyColor",
  "secondaryColor" = (CASE lower(trim(split_part(replace("color", '&', '/'), '/', 2)))
    WHEN 'red' THEN 'RED' WHEN 'orange' THEN 'ORANGE' WHEN 'yellow' THEN 'YELLOW' WHEN 'green' THEN 'GREEN'
    WHEN 'blue' THEN 'BLUE' WHEN 'purple' THEN 'PURPLE' WHEN 'pink' THEN 'PINK' WHEN 'brown' THEN 'BROWN'
    WHEN 'natural' THEN 'NATURAL_WOOD' WHEN 'black' THEN 'BLACK' WHEN 'white' THEN 'WHITE' WHEN 'grey' THEN 'GREY' END)::"ToyColor"
WHERE "color" ~ '[/&]';
UPDATE "Toy" SET "colorType" = 'MULTI', "primaryColor" = NULL, "secondaryColor" = NULL
WHERE "colorType" = 'DUAL' AND ("primaryColor" IS NULL OR "secondaryColor" IS NULL);
UPDATE "Toy" SET "colorType" = 'SINGLE',
  "primaryColor" = (CASE lower(trim("color"))
    WHEN 'red' THEN 'RED' WHEN 'orange' THEN 'ORANGE' WHEN 'yellow' THEN 'YELLOW' WHEN 'green' THEN 'GREEN'
    WHEN 'blue' THEN 'BLUE' WHEN 'purple' THEN 'PURPLE' WHEN 'pink' THEN 'PINK' WHEN 'brown' THEN 'BROWN'
    WHEN 'natural' THEN 'NATURAL_WOOD' WHEN 'black' THEN 'BLACK' WHEN 'white' THEN 'WHITE' WHEN 'grey' THEN 'GREY' END)::"ToyColor"
WHERE "color" !~ '[/&]' AND lower(trim("color")) IN ('red','orange','yellow','green','blue','purple','pink','brown','natural','black','white','grey');
