import re
import sys

def check_tags(file_path):
    with open(file_path, 'r') as f:
        code = f.read()
    
    # Strip comments
    code = re.sub(r'\{/\*.*?\*/\}', '', code, flags=re.DOTALL)
    code = re.sub(r'//.*', '', code)
    
    lines = code.split('\n')
    stack = []
    
    for i, line in enumerate(lines):
        # finding simple tags
        tags = re.finditer(r'<(/?)\s*([a-zA-Z][a-zA-Z0-9]*)[^>]*?(/?)>', line)
        for tag in tags:
            is_closing = tag.group(1) == '/'
            is_self_closing = tag.group(3) == '/'
            name = tag.group(2)
            
            # exclude Fragment since it has no visual HTML representation often, but we want to check AST matching...
            if name in ['Fragment', 'br', 'hr', 'img', 'input', 'Link', 'Check', 'Trash2', 'AlertTriangle', 'X', 'Camera', 'Layout', 'User', 'Phone', 'Mail', 'DollarSign', 'BookOpen', 'Users', 'Percent', 'Calendar', 'Plus', 'Eye', 'EyeOff', 'React.Fragment', 'SearchSelect']: 
                continue
                
            if is_closing:
                if stack and stack[-1] == name:
                    stack.pop()
                else:
                    print(f"[{file_path}:{i+1}] Unexpected closing tag: </{name}>. Current stack top is {stack[-1] if stack else 'EMPTY'}")
            elif not is_self_closing:
                stack.append(name)
                
    if stack:
        print(f"[{file_path}] Unclosed tags at EOF: {stack}")
    else:
        print(f"[{file_path}] PERFECTLY BALANCED")

check_tags('src/components/groups/GroupModal.tsx')
check_tags('src/components/teachers/TeacherModal.tsx')
check_tags('src/components/students/StudentModal.tsx')
check_tags('src/components/halls/HallModal.tsx')
