import sys
import os

file_path = 'src/contexts/StudioContext.tsx'
with open(file_path, 'r', encoding='utf-8', errors='ignore') as f:
    lines = f.readlines()

bootstrap_idx = -1
for i, line in enumerate(lines):
    if 'async function bootstrap()' in line:
        bootstrap_idx = i
        break

if bootstrap_idx != -1:
    # Find the next line after {
    insert_pos = -1
    for i in range(bootstrap_idx, bootstrap_idx + 5):
        if '{' in lines[i]:
            insert_pos = i + 1
            break
    
    if insert_pos != -1:
        new_logic = [
            '            let activeSlug = getActiveSlug();\n',
            '            \n',
            '            // EMERGENCY RECOVERY FOR stdancestudio\n',
            '            if (activeSlug === "subscriptions" || activeSlug === "settings" || !activeSlug) {\n',
            '                const userEmail = profile?.email || (user as any)?.email;\n',
            '                if (userEmail === "stdancegroup@gmail.com") {\n',
            '                    console.log("🚨 [Emergency] Redirecting corrupted slug to stdancestudio");\n',
            '                    activeSlug = "stdancestudio";\n',
            '                    localStorage.setItem("cc_active_studio_slug", "stdancestudio");\n',
            '                }\n',
            '            }\n',
            '\n'
        ]
        # We need to replace the original let activeSlug = getActiveSlug(); if it exists
        # Actually I'll just find the next few lines and replace them
        search_limit = min(insert_pos + 40, len(lines))
        old_bootstrap_end = -1
        for j in range(insert_pos, search_limit):
            if 'if (state) {' in lines[j]: # This is the start of hydration
                old_bootstrap_end = j
                break
        
        if old_bootstrap_end != -1:
             hydration_logic = [
                '            if (!activeSlug || ["superadmin", "dashboard", "auth", "admin", "login", "settings", "billing", "analytics", "history", "attendance", "students", "teachers", "halls", "groups", "calendar", "shop", "sms-manager", "subscriptions"].includes(activeSlug)) {\n',
                '                setIsLoaded(true);\n',
                '                return;\n',
                '            }\n',
                '\n',
                '            try {\n',
                '                const targetOrgId = await import("@/lib/master-sync").then(mod => mod.ensureStudioExists(activeSlug || "default", settings.studioName));\n',
                '                if (targetOrgId) {\n',
                '                    const { fetchFullStudioState } = await import("@/lib/master-sync");\n',
                '                    const state = await fetchFullStudioState(activeSlug || "default", targetOrgId);\n'
             ]
             lines[insert_pos : old_bootstrap_end] = new_logic + hydration_logic
             
             with open(file_path, 'w', encoding='utf-8') as f:
                 f.writelines(lines)
             print("SUCCESS")
        else:
            print("COULD NOT FIND HYDRATION START")
    else:
        print("COULD NOT FIND BRACE")
else:
    print("COULD NOT FIND BOOTSTRAP")
