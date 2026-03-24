import { NextResponse } from 'next/server';
import { put, del } from '@vercel/blob';
import { supabase } from '@/lib/supabase';

export const dynamic = 'force-dynamic';

export async function GET() {
    try {
        const { data: db, error } = await supabase
            .from('recordings')
            .select('*')
            .order('date', { ascending: false });

        if (error) throw error;

        return NextResponse.json({ recordings: db || [] }, {
            headers: {
                'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
                'Pragma': 'no-cache',
                'Expires': '0'
            }
        });

    } catch (error) {
        console.error("GET DB Error:", error);
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

        // 1. Upload video to Vercel Blob ONLY
        const blobResponse = await put(fileName, file, { access: 'public' });

        const dateStr = formData.get('date') as string;

        const recording = {
            id: fileName,
            url: blobResponse.url,
            name: fileName,
            date: dateStr || new Date().toLocaleString(),
            transcription: transcriptionJson ? JSON.parse(transcriptionJson) : []
        };

        // 2. Insert robust metadata to Supabase
        const { error } = await supabase
            .from('recordings')
            .insert([recording]);

        if (error) throw error;

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

        const { data: db, error } = await supabase
            .from('recordings')
            .update({ name: newName })
            .eq('url', url)
            .select();

        if (error) throw error;

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

        // 1. Delete video from Vercel blob
        try {
            await del(url);
        } catch (delErr) {
            console.warn("Vercel blob delete failed, proceeding to remove from db anyway:", delErr);
        }

        // 2. Delete metadata from Supabase
        const { data: db, error } = await supabase
            .from('recordings')
            .delete()
            .eq('url', url)
            .select();

        if (error) throw error;

        return NextResponse.json({ success: true, recordings: db }, {
            headers: { 'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate' }
        });
    } catch (error) {
        console.error(error);
        return NextResponse.json({ error: 'Failed to delete' }, { status: 500 });
    }
}
