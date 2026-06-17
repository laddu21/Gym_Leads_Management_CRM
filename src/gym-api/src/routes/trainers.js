const express = require('express');
const { v4: uuid } = require('uuid');
const { readDb, updateDb } = require('../storage');

const router = express.Router();

router.get('/', (req, res) => {
    const data = readDb();
    res.json(data.trainers || []);
});

router.post('/', (req, res) => {
    const { name, specialty, experienceYears, email, phone } = req.body;
    if (!name) {
        return res.status(400).json({ error: 'name is required' });
    }
    let newTrainer;
    const nextData = updateDb((data) => {
        newTrainer = {
            id: uuid(),
            name,
            specialty: specialty || '',
            experienceYears: typeof experienceYears === 'number' ? experienceYears : null,
            email: email || '',
            phone: phone || ''
        };
        return {
            ...data,
            trainers: [...(data.trainers || []), newTrainer]
        };
    });
    res.status(201).json({ data: newTrainer, total: nextData.trainers.length });
});

router.patch('/:id', (req, res) => {
    const { id } = req.params;
    const { name, specialty, experienceYears, email, phone } = req.body;
    let updatedTrainer = null;
    let found = false;
    updateDb((data) => {
        const trainers = (data.trainers || []).map((trainer) => {
            if (trainer.id === id) {
                found = true;
                updatedTrainer = {
                    ...trainer,
                    name: name || trainer.name,
                    specialty: specialty !== undefined ? specialty : trainer.specialty,
                    experienceYears: typeof experienceYears === 'number' ? experienceYears : trainer.experienceYears,
                    email: email !== undefined ? email : trainer.email,
                    phone: phone !== undefined ? phone : trainer.phone
                };
                return updatedTrainer;
            }
            return trainer;
        });
        return {
            ...data,
            trainers
        };
    });

    if (!found) {
        return res.status(404).json({ error: 'Trainer not found' });
    }

    res.json({ data: updatedTrainer });
});

router.delete('/:id', (req, res) => {
    const { id } = req.params;
    let removed = null;
    let changed = false;
    updateDb((data) => {
        const trainers = (data.trainers || []).filter((trainer) => {
            if (trainer.id === id) {
                removed = trainer;
                changed = true;
                return false;
            }
            return true;
        });
        return {
            ...data,
            trainers
        };
    });

    if (!changed) {
        return res.status(404).json({ error: 'Trainer not found' });
    }

    res.json({ data: removed });
});

module.exports = router;
