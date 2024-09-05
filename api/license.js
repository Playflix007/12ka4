import path from 'path';
import fs from 'fs';

export default function handler(req, res) {
    const { id } = req.query;
    const filePath = path.resolve('./licenses', `${id}.json`);

    if (fs.existsSync(filePath)) {
        const fileContent = fs.readFileSync(filePath, 'utf-8');
        res.status(200).json(JSON.parse(fileContent));
    } else {
        res.status(404).json({ error: 'License not found' });
    }
}
