import os
import re

def check_parity(content, open_token, close_token, is_jsx=False):
    # For JSX tags like <div, we need to skip self-closing <div ... />
    if is_jsx and open_token == '<div':
        # Find all <div not followed by /> on the same line (simple approximation)
        open_count = len(re.findall(r'<div(?![^>]*?/\s*>)', content))
        close_count = content.count('</div>')
        return open_count, close_count
    
    return content.count(open_token), content.count(close_token)

def audit_file(filepath):
    results = []
    try:
        with open(filepath, 'r', encoding='utf-8') as f:
            content = f.read()
            lines = content.split('\n')
            
            # 1. Parity Checks
            # Braces
            ob, cb = check_parity(content, '{', '}')
            if ob != cb: results.append(f"Mismatched braces: {{ {ob} vs }} {cb}")
            
            # Parentheses
            op, cp = check_parity(content, '(', ')')
            if op != cp: results.append(f"Mismatched parentheses: ( {op} vs ) {cp}")
            
            # Backticks
            bt = content.count('`')
            if bt % 2 != 0: results.append(f"Odd number of backticks: {bt}")
            
            # TSX specific
            if filepath.endswith('.tsx'):
                # Fragments
                of, cf = check_parity(content, '<>', '</>')
                if of != cf: results.append(f"Mismatched fragments: <> {of} vs </> {cf}")
                
                # Divs
                od, cd = check_parity(content, '<div', '</div>', is_jsx=True)
                if od != cd: results.append(f"Mismatched divs: <div {od} vs </div> {cd}")

            # 2. Garbage Pattern detection (Heuristic)
            for i, line in enumerate(lines):
                # Pattern: Tag followed by random text on same line (truncation artifact)
                if re.search(r'<(button|div|Row|Section)[^>]*?\s+[a-z]{3,}', line) and not re.search(r'className=|onClick=|style=', line):
                     results.append(f"L{i+1}: Potential corrupted tag or orphaned fragment: '{line.strip()[:50]}...'")
                
                # Pattern: Line ends with something weird followed by a tag
                if re.search(r'[a-zA-Z0-9]\s+<(button|div|Row|Section)', line):
                     results.append(f"L{i+1}: Suspicious tag transition: '{line.strip()[:50]}...'")

    except Exception as e:
        results.append(f"Error reading file: {str(e)}")
    
    return results

def run_audit(root_dir):
    report = {}
    for root, dirs, files in os.walk(root_dir):
        if 'node_modules' in root or '.git' in root or '.next' in root:
            continue
        for file in files:
            if file.endswith(('.ts', '.tsx')):
                path = os.path.join(root, file)
                file_results = audit_file(path)
                if file_results:
                    report[path] = file_results
    return report

if __name__ == "__main__":
    target = "/Users/sergitsivtsivadze/Downloads/studioflow/src"
    audit_report = run_audit(target)
    
    if not audit_report:
        print("✅ No structural issues found in scrutinized files.")
    else:
        print("🔍 Audit Results:")
        for path, issues in audit_report.items():
            print(f"\n--- {path} ---")
            for issue in issues:
                print(f"  - {issue}")
