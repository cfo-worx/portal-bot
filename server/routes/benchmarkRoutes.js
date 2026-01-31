// server/routes/benchmarkRoutes.js
import express from 'express';
import Benchmark from '../models/Benchmark.js';

const router = express.Router();

// Get all benchmarks for a client
router.get('/client/:clientId', async (req, res) => {
  try {
    const benchmarks = await Benchmark.getByClientId(req.params.clientId);
    res.json(benchmarks);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch benchmarks.' });
  }
});

// Create a new benchmark
router.post('/', async (req, res) => {
  try {
    const benchmark = await Benchmark.create(req.body);
    res.status(201).json(benchmark);
  } catch (error) {
    res.status(500).json({ error: 'Failed to create benchmark.' });
  }
});

// Update a benchmark
router.put('/:benchmarkId', async (req, res) => {
  try {
    const updatedBenchmark = await Benchmark.update(req.params.benchmarkId, req.body);
    res.json(updatedBenchmark);
  } catch (error) {
    res.status(500).json({ error: 'Failed to update benchmark.' });
  }
});

// Delete a benchmark
router.delete('/:benchmarkId', async (req, res) => {
  try {
    const success = await Benchmark.delete(req.params.benchmarkId);
    if (success) {
      res.json({ message: 'Benchmark deleted successfully.' });
    } else {
      res.status(404).json({ error: 'Benchmark not found.' });
    }
  } catch (error) {
    res.status(500).json({ error: 'Failed to delete benchmark.' });
  }
});

// Get all benchmarks (for bulk management)
router.get('/all', async (req, res) => {
  try {
    const benchmarks = await Benchmark.getAll();
    res.json(benchmarks);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch benchmarks.' });
  }
});

// Bulk update distribution types
router.post('/bulk-update-distribution', async (req, res) => {
  try {
    const { benchmarkIds, distributionType } = req.body;
    if (!Array.isArray(benchmarkIds) || !distributionType) {
      return res.status(400).json({ error: 'benchmarkIds (array) and distributionType are required.' });
    }
    const result = await Benchmark.bulkUpdateDistributionType(benchmarkIds, distributionType);
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: 'Failed to bulk update distribution types.' });
  }
});

export default router;
