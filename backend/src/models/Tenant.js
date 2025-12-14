import mongoose from 'mongoose';
const TenantSchema = new mongoose.Schema({
  tenantId: { type: String, required: true, unique: true, index: true },
  name: { type: String, required: true },
  plan: { type: String, default: 'standard' },
}, { timestamps: true });


export default mongoose.model('Tenant', TenantSchema);