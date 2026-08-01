const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, 'expensee', 'src', 'components', 'TransactionManager.tsx');
let c = fs.readFileSync(filePath, 'utf8');

// Fix voucher_id to also try voucherId (old camelCase)
c = c.replace(
  "voucherId:   String(t.voucher_id ?? ''),",
  "voucherId:   String(t.voucher_id ?? t.voucherId ?? ''),"
);

// Fix category_id to also try categoryId (old camelCase)
c = c.replace(
  "categoryId:  t.category_id ? String(t.category_id) : '',",
  "categoryId:  String(t.category_id ?? t.categoryId ?? ''),"
);

// Fix financial_user_id to also try userId (old camelCase)
c = c.replace(
  "userId:      t.financial_user_id ? String(t.financial_user_id) : '',",
  "userId:      String(t.financial_user_id ?? t.userId ?? ''),"
);

// Fix created_at to also try createdAt
c = c.replace(
  "createdAt:   String(t.created_at ?? ''),",
  "createdAt:   String(t.created_at ?? t.createdAt ?? ''),"
);

// Fix updated_at to also try updatedAt
c = c.replace(
  "updatedAt:   String(t.updated_at ?? ''),",
  "updatedAt:   String(t.updated_at ?? t.updatedAt ?? ''),"
);

fs.writeFileSync(filePath, c);
console.log('TransactionManager.tsx patched successfully');
