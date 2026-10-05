import { readFileSync } from 'fs';

const svg = readFileSync(new URL('../favicon.svg', import.meta.url), 'utf8');
const nonCircularMarks = svg.match(/<(?:path|polygon|line|polyline|rect)\b/g) || [];

if (nonCircularMarks.length > 0) {
    console.error(`not ok - favicon contains ${nonCircularMarks.length} non-circular compass-like mark(s)`);
    process.exitCode = 1;
} else {
    console.log('ok - favicon is composed only of circular record grooves');
}
