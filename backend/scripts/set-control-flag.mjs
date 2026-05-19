import 'dotenv/config';
import connectDB, { disconnectDB } from '../config/db.js';
import ControlFlag from '../models/ControlFlag.js';

function arg(name, fallback = null) {
    const index = process.argv.indexOf(`--${name}`);
    return index >= 0 ? process.argv[index + 1] : fallback;
}

const key = arg('key');
const scopeType = arg('scope-type', 'global');
const scopeId = arg('scope-id', '*');
const rawValue = arg('value');
const reason = arg('reason', '');

if (!key || rawValue === null) {
    console.error('Usage: node scripts/set-control-flag.mjs --key <KEY> --value <true|false|L1|L2|L3> [--scope-type global|feature|user] [--scope-id <id>] [--reason <text>]');
    process.exit(1);
}

const value = rawValue === 'true' ? true : rawValue === 'false' ? false : rawValue;

try {
    await connectDB();
    const flag = await ControlFlag.findOneAndUpdate(
        { key, scopeType, scopeId },
        { $set: { value, reason }, $inc: { version: 1 } },
        { upsert: true, new: true, setDefaultsOnInsert: true }
    );
    console.log(JSON.stringify({ success: true, flag }, null, 2));
} catch (err) {
    console.error(JSON.stringify({ success: false, message: err.message }, null, 2));
    process.exitCode = 1;
} finally {
    await disconnectDB();
}
