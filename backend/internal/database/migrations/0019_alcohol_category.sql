ALTER TABLE products DROP CONSTRAINT products_category_check;
ALTER TABLE products ADD CONSTRAINT products_category_check
 CHECK(category IN ('dairy','vegetables','meat','drinks','alcohol','other'));
