import { NextResponse } from 'next/server';
export async function GET(){return NextResponse.json({error:'Free access uses the starter branch for each course and format.'},{status:410});}
export const POST=GET;
