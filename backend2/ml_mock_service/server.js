import express from 'express';

const app = express();
app.use(express.json());

const ML_PORT = process.env.ML_PORT || 5005;

/**
 * ML Prediction Endpoint
 * Contract expected by the backend
 */
app.post('/predict', (req, res) => {
  const {
    center_id = 'default_center',
    queue_position = 1,
    farmers_ahead = Math.max(0, queue_position - 1),
    processing_farmers = 2,
    quantity_kg,
    estimated_quantity_qtl = quantity_kg ? quantity_kg / 100 : 30,
    crop_type,
    crop_id = (crop_type || 'wheat').toLowerCase().replace(/\s+/g, '_'),
    active_bays = processing_farmers || 4,
    vehicle_type = 'Tractor-Trolley',
    hour_of_day = new Date().getHours() || 11
  } = req.body;

  const position = Number(queue_position);

  console.log(`🤖 [ML Model Service] Received inference request:`);
  console.log(`   Center: ${center_id} | Queue Pos: ${position} | Ahead: ${farmers_ahead} | Processing: ${active_bays} | Crop: ${crop_type || crop_id} | Qty(kg): ${quantity_kg || estimated_quantity_qtl * 100}`);

  if (position <= 0) {
    return res.json({
      queue_position: 0,
      predicted_waiting_time: 0,
      unit: 'minutes',
      predicted_wait_minutes: 0,
      confidence_score: 1.0,
      model_version: 'rf-regressor-v2.1'
    });
  }

  // Trained Random Forest / Gradient Boosting regressor simulation
  const vehicleCoeff = {
    'Tractor-Trolley': 4.2,
    'Mini-Truck': 2.3,
    'Truck': 8.5,
    'Pickup': 1.8,
    'Bullock-Cart': 3.1
  }[vehicle_type] || 3.0;

  const cropCoeff = {
    mustard: 3.2,
    soybean: 2.8,
    wheat: 1.4,
    paddy_common: 2.0,
    paddy_grade_a: 2.0,
    cotton: 4.0,
    gram: 2.2,
    maize: 2.1
  }[crop_id] || 1.8;

  const baseHandling = 11.5;
  const quantityEffect = Math.max(0, estimated_quantity_qtl - 20) * 0.07;
  const congestion = (hour_of_day >= 10 && hour_of_day <= 13) ? 1.2 : 1.0;

  const effectiveAhead = farmers_ahead !== undefined ? Number(farmers_ahead) : Math.max(0, position - 1);
  const effectiveBays = Math.max(1, Number(active_bays));

  const rawWait = ((effectiveAhead + 1) / effectiveBays) * (baseHandling + vehicleCoeff + cropCoeff + quantityEffect) * congestion;
  const predictedWait = Math.max(3, parseFloat(rawWait.toFixed(2)));

  res.json({
    success: true,
    queue_position: position,
    predicted_waiting_time: predictedWait,
    unit: 'minutes',
    predicted_wait_minutes: Math.round(predictedWait),
    confidence_score: 0.942,
    model_version: 'kisan-randomforest-v2.1',
    features_received: req.body
  });
});

app.get('/health', (req, res) => {
  res.json({ status: 'healthy', service: 'Farmer Waiting-Time ML Model Microservice' });
});

export default app;

if (process.argv[1] && process.argv[1].includes('ml_mock_service')) {
  app.listen(ML_PORT, () => {
    console.log(`🤖 ML Model Microservice running on http://localhost:${ML_PORT}`);
    console.log(`   Inference endpoint: POST http://localhost:${ML_PORT}/predict`);
  });
}
