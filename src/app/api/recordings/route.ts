import { NextResponse } from 'next/server';
import { put, head } from '@vercel/blob';

export async function GET() {
    try {
        let db: any[] = [];
        try {
            const dbBlob = await head('db.json');
            if (dbBlob) {
                const response = await fetch(dbBlob.url);
                db = await response.json();
            }
        } catch (e) {
            db = []; // if db.json doesn't exist yet
        }

        return NextResponse.json({ recordings: db });

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

        const fileName = `Recording-${Date.now()}.webm`;

        // Upload the video file to Vercel Blob
        const blobResponse = await put(fileName, file, { access: 'public' });

        const recording = {
            id: fileName,
            url: blobResponse.url,
            name: fileName,
            date: new Date().toLocaleString(),
            transcription: transcriptionJson ? JSON.parse(transcriptionJson) : []
        };

        // Update the db.json in Vercel Blob
        let db: any[] = [];
        try {
            const dbBlob = await head('db.json');
            if (dbBlob) {
                const response = await fetch(dbBlob.url);
                db = await response.json();
            }
        } catch (e) {
            db = [];
        }

        db.push(recording);
        await put('db.json', JSON.stringify(db), {
            access: 'public',
            contentType: 'application/json',
            addRandomSuffix: false
        });

        return NextResponse.json({ success: true, recording });

    } catch (error) {
        console.error("Backend Error:", error);
        return NextResponse.json({ error: 'Failed to save recording' }, { status: 500 });
    }
}
