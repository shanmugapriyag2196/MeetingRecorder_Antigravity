import { NextResponse } from 'next/server';
import { writeFile, mkdir, readFile } from 'fs/promises';
import { join } from 'path';
import { existsSync } from 'fs';

const RECORDINGS_DIR = join(process.cwd(), 'public', 'recordings');

export async function GET() {
    try {
        if (!existsSync(RECORDINGS_DIR)) {
            return NextResponse.json({ recordings: [] });
        }

        const dbPath = join(RECORDINGS_DIR, 'db.json');
        if (!existsSync(dbPath)) {
            return NextResponse.json({ recordings: [] });
        }

        const db = await readFile(dbPath, 'utf8');
        return NextResponse.json({ recordings: JSON.parse(db) });

    } catch (error) {
        console.error(error);
        return NextResponse.json({ error: 'Failed to fetch recordings' }, { status: 500 });
    }
}

export async function POST(req: Request) {
    try {
        const formData = await req.formData();
        const file = formData.get('file') as Blob;
        const transcriptionJson = formData.get('transcription') as string;

        if (!file) {
            return NextResponse.json({ error: 'No file found' }, { status: 400 });
        }

        const buffer = Buffer.from(await file.arrayBuffer());
        const fileName = `Recording-${Date.now()}.webm`;

        if (!existsSync(RECORDINGS_DIR)) {
            await mkdir(RECORDINGS_DIR, { recursive: true });
        }

        await writeFile(join(RECORDINGS_DIR, fileName), buffer);

        const recording = {
            id: fileName,
            url: `/recordings/${fileName}`,
            name: fileName,
            date: new Date().toLocaleString(),
            transcription: transcriptionJson ? JSON.parse(transcriptionJson) : []
        };

        const dbPath = join(RECORDINGS_DIR, 'db.json');
        let db: any[] = [];
        if (existsSync(dbPath)) {
            try {
                db = JSON.parse(await readFile(dbPath, 'utf8'));
            } catch (e) {
                db = [];
            }
        }
        db.push(recording);
        await writeFile(dbPath, JSON.stringify(db));

        return NextResponse.json({ success: true, recording });

    } catch (error) {
        console.error("Backend Error:", error);
        return NextResponse.json({ error: 'Failed to save recording' }, { status: 500 });
    }
}
