require('dotenv').config();
const bcrypt = require('bcryptjs');
const prisma = require('../src/config/database');
const { run } = require('../src/config/tenant');
async function main() {
  const first = await prisma.$raw.company.findUnique({where:{short_code:'SHELFY'}}) || await prisma.$raw.company.findFirst({orderBy:{id:'asc'}});
  const second = await prisma.$raw.company.upsert({where:{short_code:'NOVA'},create:{name:'Nova Retail Company',short_code:'NOVA'},update:{}});
  for (const company of [first,second]) await run({tenant_id:company.id},async()=>{
  if (await prisma.user.count()) { console.log(`${company.short_code}: existing data preserved.`); return; }
  await prisma.$transaction(async tx => {
    const manager = await tx.user.create({ data: { login_id: 'manager', name: 'Alex Rivera', email: 'manager@stocksense.com', password_hash: await bcrypt.hash('Manager@123', 10), role: 'manager' } });
    await tx.user.create({ data: { login_id: 'staff01', name: 'Sam Taylor', email: 'staff@stocksense.com', password_hash: await bcrypt.hash('Staff@123', 10), role: 'staff' } });
    const main = await tx.warehouse.create({ data: { name: 'Main Distribution Center', short_code: 'WH', address: '42 Industrial Estate, Ahmedabad' } });
    const north = await tx.warehouse.create({ data: { name: 'North Fulfillment Hub', short_code: 'NH', address: '18 Logistics Park, Delhi' } });
    const loc = await tx.location.create({ data: { name: 'Main Stock', short_code: 'Stock1', warehouse_id: main.id } });
    await tx.location.create({ data: { name: 'Receiving Dock', short_code: 'Input', warehouse_id: main.id } });
    await tx.location.create({ data: { name: 'North Stock', short_code: 'Stock1', warehouse_id: north.id } });
    const categories = [];
    for (const name of ['Electronics', 'Office supplies', 'Packaging']) categories.push(await tx.category.create({ data: { name } }));
    const products = [];
    for (const [name, sku, cost, qty, cat] of [['Wireless Keyboard', 'ELEC-001', 45, 120, 0], ['USB-C Hub', 'ELEC-002', 65, 6, 0], ['Monitor Stand', 'OFF-001', 35, 42, 1], ['Shipping Box', 'PKG-001', 2.5, 350, 2], ['Thermal Label Roll', 'PKG-002', 12, 0, 2]]) {
      const p = await tx.product.create({ data: { name, sku, per_unit_cost: cost, category_id: categories[cat].id } }); products.push(p);
      await tx.stockLedger.create({ data: { product_id: p.id, location_id: loc.id, quantity_delta: qty, movement_type: 'adjustment', reference_type: 'initial', reference_id: p.id, created_by: manager.id } });
    }
    const scheduled = offset => new Date(Date.now() + offset * 86400000);
    for (const [i, status] of ['draft', 'ready'].entries()) await tx.receipt.create({ data: { reference: `WH/IN/000${i + 1}`, warehouse_id: main.id, supplier_name: i ? 'Apex Electronics' : 'Packwell Supplies', contact: i ? 'Apex Electronics' : 'Packwell Supplies', responsible: manager.name, schedule_date: scheduled(i ? -1 : 2), status, created_by: manager.id, items: { create: { product_id: products[i].id, location_id: loc.id, quantity_expected: 30 } } } });
    for (const [i, status] of ['ready', 'waiting', 'draft'].entries()) await tx.deliveryOrder.create({ data: { reference: `WH/OUT/000${i + 1}`, warehouse_id: main.id, customer_ref: ['Acme Studios', 'Northstar Retail', 'Orbit Labs'][i], contact: ['Acme Studios', 'Northstar Retail', 'Orbit Labs'][i], responsible: manager.name, delivery_address: 'Customer distribution center', schedule_date: scheduled(i - 1), status, created_by: manager.id, items: { create: { product_id: products[i === 1 ? 4 : 0].id, location_id: loc.id, quantity: 10 } } } });
    await tx.referenceCounter.createMany({ data: [{ key: `${company.id}/${main.id}/IN`, value: 2 }, { key: `${company.id}/${main.id}/OUT`, value: 3 }] });
  });
  });
  console.log('Demo companies SHELFY and NOVA. Login: manager / Manager@123 or staff01 / Staff@123');
}
main().catch(e => { console.error(e); process.exitCode = 1; }).finally(() => prisma.$disconnect());
