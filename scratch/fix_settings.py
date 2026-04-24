import sys
import os

file_path = 'src/app/(dashboard)/settings/page.tsx'
if not os.path.exists(file_path):
    print("FILE NOT FOUND")
    sys.exit(1)

with open(file_path, 'r', encoding='utf-8', errors='ignore') as f:
    lines = f.readlines()

# Find Logo end - search for the type="file" around line 580
logo_end_idx = -1
for i, line in enumerate(lines):
    if 570 < i < 590 and 'type="file"' in line:
        logo_end_idx = i
        break

# Find registrationLink start - search for registrationLink around line 610-660
reg_start_idx = -1
for i, line in enumerate(lines):
    if 600 < i < 680 and 'registrationLink' in line and '<Row' in line:
        reg_start_idx = i
        break

print(f"DEBUG: logo_end_idx={logo_end_idx}, reg_start_idx={reg_start_idx}")

if logo_end_idx != -1 and reg_start_idx != -1:
    new_content = [
        '                                    ref={fileRef} \n',
        '                                    onChange={handleLogoUpload} \n',
        '                                    accept="image/*" \n',
        '                                    className="hidden" \n',
        '                                />\n',
        '                            </div>\n',
        '                        </Row>\n',
        '\n',
        '                        <Row label={t.studioNameLabel} sub={l(\'სტუდიის სახელი, რომელიც გამოჩნდება ყველგან\', \'Название студии, которое будет отображаться везде\', \'Studio name that will appear everywhere\')}>\n',
        '                            <div className="flex items-center gap-2 w-full">\n',
        '                                <input \n',
        '                                    value={nameVal} \n',
        '                                    onChange={e => setNameVal(e.target.value)}\n',
        '                                    onKeyDown={e => e.key === \'Enter\' && saveName()} \n',
        '                                    className="w-full max-w-md bg-surface border border-border-subtle focus:border-indigo-500/40 rounded-xl px-4 py-2.5 text-sm font-bold text-primary outline-none transition-all"\n',
        '                                />\n',
        '                                <button onClick={saveName} className={cn(\'w-10 h-10 flex-shrink-0 flex items-center justify-center rounded-xl transition-all\', nameSaved ? \'bg-emerald-500/20 text-emerald-600\' : \'bg-surface text-muted hover:bg-surface hover:text-primary border border-border-subtle\')}>\n',
        '                                    {nameSaved ? <Check className="w-4 h-4" /> : <Save className="w-4 h-4" />}\n',
        '                                </button>\n',
        '                            </div>\n',
        '                        </Row>\n',
        '\n',
        '                        <Row label={t.urlSlugLabel} sub={l(\'სტუდიის უნიკალური მისამართი\', \'Уникальный адрес студии\', \'Unique studio address\')}>\n',
        '                            <div className="flex flex-col gap-2 items-start w-full">\n',
        '                                <div className="flex items-center gap-2 w-full px-4 py-2.5 bg-surface/50 border border-border-subtle rounded-xl max-w-md cursor-not-allowed">\n',
        '                                    <span className="text-muted/40 text-xs font-mono">/</span>\n',
        '                                    <span className="text-sm font-mono text-muted/60">{slugVal}</span>\n',
        '                                    <Shield className="w-3.5 h-3.5 ml-auto text-muted/20" />\n',
        '                                </div>\n',
        '                            </div>\n',
        '                        </Row>\n',
        '\n'
    ]
    
    # We replace from line after logo_end_idx to line before reg_start_idx
    lines[logo_end_idx+1 : reg_start_idx] = new_content
    
    with open(file_path, 'w', encoding='utf-8') as f:
        f.writelines(lines)
    print("SUCCESS")
else:
    print("COULD NOT FIND MARKERS")
