import { NextResponse } from "next/server";
import fs from "fs";
import path from "path";

export async function GET() {
    try {
        const basePath = path.join(process.cwd(), "src/app/(superadmin)");
        const dirsToDelete = ["billing", "studios", "system", "users"];

        const results = [];

        for (const dir of dirsToDelete) {
            const fullPath = path.join(basePath, dir);
            if (fs.existsSync(fullPath)) {
                fs.rmSync(fullPath, { recursive: true, force: true });
                results.push(`Deleted ${dir}`);
            } else {
                results.push(`Skipped ${dir} (Not Found)`);
            }
        }

        return NextResponse.json({ success: true, results });
    } catch (error: any) {
        return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }
}
