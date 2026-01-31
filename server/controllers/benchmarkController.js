// server/controllers/benchmarkController.js
import Benchmark from '../models/Benchmark.js';
import { v4 as uuidv4 } from 'uuid';

export const getBenchmarksByClient = async (req, res) => {
  try {
    const benchmarks = await Benchmark.getByClientId(req.params.clientId);
    res.json(benchmarks);
  } catch (error) {
    console.error('Error fetching benchmarks:', error);
    res.status(500).json({ error: 'Failed to fetch benchmarks.' });
  }
};

export const addBenchmark = async (req, res) => {
  try {
    const data = {
      ...req.body,
      BenchmarkID: uuidv4(),
      CreatedOn: new Date(),
      UpdatedOn: new Date(),
    };
    console.log('addBenchmark data:', data);
    const newBenchmark = await Benchmark.create(data);
    res.status(201).json(newBenchmark);
  } catch (error) {
    console.error('Error adding benchmark:', error);
    res.status(500).json({ error: 'Failed to create benchmark.' });
  }
};

export const updateBenchmark = async (req, res) => {
  try {
    console.log('updateBenchmark params:', req.params);
    console.log('updateBenchmark body:', req.body);
    const updatedBenchmark = await Benchmark.update(req.params.benchmarkId, {
      ...req.body,
      UpdatedOn: new Date(),
    });
    if (updatedBenchmark) {
      res.json(updatedBenchmark);
    } else {
      console.warn('No benchmark found for update:', req.params.benchmarkId);
      res.status(404).json({ error: 'Benchmark not found.' });
    }
  } catch (error) {
    console.error('Error updating benchmark:', error);
    res.status(500).json({ error: 'Failed to update benchmark.' });
  }
};

export const deleteBenchmark = async (req, res) => {
  try {
    console.log('deleteBenchmark params:', req.params);
    const success = await Benchmark.delete(req.params.benchmarkId);
    if (success) {
      res.json({ message: 'Benchmark deleted successfully.' });
    } else {
      res.status(404).json({ error: 'Benchmark not found.' });
    }
  } catch (error) {
    console.error('Error deleting benchmark:', error);
    res.status(500).json({ error: 'Failed to delete benchmark.' });
  }
};
