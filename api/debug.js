export default function handler(req, res) {
  res.json({
    hasKey: !!process.env.COC_API_KEY,
    keyLength: process.env.COC_API_KEY?.length || 0,
    keyStart: process.env.COC_API_KEY?.substring(0, 20) || 'empty',
  });
}