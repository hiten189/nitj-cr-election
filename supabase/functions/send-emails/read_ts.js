const fs = require('fs');
const content = fs.readFileSync('c:/Users/HITEN/OneDrive/Hiten/ipe-voting sytem/supabase/functions/send-emails/index.ts', 'utf8');
fs.writeFileSync('c:/Users/HITEN/OneDrive/Hiten/ipe-voting sytem/supabase/functions/send-emails/index_temp.txt', content);
console.log('done');
