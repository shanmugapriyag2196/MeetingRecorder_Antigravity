import { NextResponse } from 'next/server';
import { put, head, del } from '@vercel/blob';

export const dynamic = 'force-dynamic';

export async function GET() {
    try {
        let db: any[] = [];
        try {
            const dbBlob = await head('db.json');
            if (dbBlob) {
                const response = await fetch(`${dbBlob.url}?t=${Date.now()}`, { cache: 'no-store' });
                db = await response.json();
            }
        } catch (e) {
            db = [];
        }

        return NextResponse.json({ recordings: db }, {
            headers: {
                'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
                'Pragma': 'no-cache',
                'Expires': '0'
            }
        });

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

        if (!file) return NextResponse.json({ error: 'No file found' }, { status: 400 });

        const fileName = `Recording-${Date.now()}.webm`;
        const blobResponse = await put(fileName, file, { access: 'public' });

        const dateStr = formData.get('date') as string;

        const recording = {
            id: fileName,
            url: blobResponse.url,
            name: fileName,
            date: dateStr || new Date().toLocaleString(),
            transcription: transcriptionJson ? JSON.parse(transcriptionJson) : []
        };

        let db: any[] = [];
        try {
            const dbBlob = await head('db.json');
            if (dbBlob) {
                const response = await fetch(`${dbBlob.url}?t=${Date.now()}`, { cache: 'no-store' });
                db = await response.json();
            }
        } catch (e) {
            db = [];
        }

        db.push(recording);
        await put('db.json', JSON.stringify(db), {
            access: 'public',
            contentType: 'application/json',
            addRandomSuffix: false,
            allowOverwrite: true
        });

        return NextResponse.json({ success: true, recording }, {
            headers: { 'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate' }
        });
    } catch (error) {
        console.error("Backend Error:", error);
        return NextResponse.json({ error: 'Failed to save recording' }, { status: 500 });
    }
}

export async function PATCH(req: Request) {
    try {
        const { url, newName } = await req.json();
        if (!url || !newName) return NextResponse.json({ error: 'Invalid config' }, { status: 400 });

        let db: any[] = [];
        try {
            const dbBlob = await head('db.json');
            if (dbBlob) {
                const response = await fetch(`${dbBlob.url}?t=${Date.now()}`, { cache: 'no-store' });
                db = await response.json();
            }
        } catch (e) {
            db = [];
        }

        db = db.map(rec => rec.url === url ? { ...rec, name: newName } : rec);
        await put('db.json', JSON.stringify(db), {
            access: 'public',
            contentType: 'application/json',
            addRandomSuffix: false,
            allowOverwrite: true
        });

        return NextResponse.json({ success: true, recordings: db }, {
            headers: { 'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate' }
        });
    } catch (error) {
        console.error(error);
        return NextResponse.json({ error: 'Failed to rename' }, { status: 500 });
    }
}

export async function DELETE(req: Request) {
    try {
        const { url } = await req.json();
        if (!url) return NextResponse.json({ error: 'No URL provided' }, { status: 400 });

        try {
            await del(url);
        } catch (delErr) {
            console.warn("Vercel blob delete failed, proceeding to remove from db anyway:", delErr);
        }

        let db: any[] = [];
        try {
            const dbBlob = await head('db.json');
            if (dbBlob) {
                const response = await fetch(`${dbBlob.url}?t=${Date.now()}`, { cache: 'no-store' });
                db = await response.json();
            }
        } catch (e) {
            db = [];
        }

        db = db.filter(rec => rec.url !== url);
        await put('db.json', JSON.stringify(db), {
            access: 'public',
            contentType: 'application/json',
            addRandomSuffix: false,
            allowOverwrite: true
        });

        return NextResponse.json({ success: true, recordings: db }, {
            headers: { 'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate' }
        });
    } catch (error) {
        console.error(error);
        return NextResponse.json({ error: 'Failed to delete' }, { status: 500 });
    }
}
