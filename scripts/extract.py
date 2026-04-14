import re

with open('src/views/Admin.jsx', 'r') as f:
    content = f.read()

# Find where the return statement starts for Admin
# `  if (!isAuthReady) {` is line 986
match = re.search(r'^\s*if \(!isAuthReady\) \{', content, re.MULTILINE)
if match:
    index = match.start()
    top_part = content[:index]
    
    # Process top part
    # Replace "export const Admin = () => {" with "export const useAdminData = () => {"
    top_part = top_part.replace('export const Admin = () => {', 'export const useAdminData = () => {\n')
    
    # We need to return an object with all the state variables
    # Let's find all the const [foo, setFoo] = useState
    # and const handleFoo = ...
    # This is slightly tricky, we can just return all local variables.
    
    state_vars = []
    
    for line in top_part.split('\n'):
        m = re.search(r'const \[(\w+),\s*set\w+\]\s*=\s*useState', line)
        if m:
            state_vars.append(m.group(1))
            var_name = m.group(1)
            # also capture the setter
            setter_match = re.search(r'set[A-Z]\w*', line)
            if setter_match:
                state_vars.append(setter_match.group(0))
        
        m_func = re.search(r'const (handle\w+)\s*=', line)
        if m_func:
            state_vars.append(m_func.group(1))
            
        m_func2 = re.search(r'const (load\w+)\s*=', line)
        if m_func2:
            state_vars.append(m_func2.group(1))

    # Add other things like stats, activePromos, menuSections etc
    other_vars = ['user', 'isAuthenticated', 'isAuthReady', 'stats', 'statsLoading', 'statsError', 'menuProducts', 'menuItemsLoading', 'menuSections', 'menuSectionsLoading', 'toppingsList', 'toppingsLoading', 'activePromos', 'promoListLoading', 'promoListError', 'carouselSlides', 'carouselItemsLoading']
    for v in other_vars:
        if v not in state_vars:
            state_vars.append(v)
            
    # return statement
    return_stmt = "  return {\n    " + ",\n    ".join(sorted(set(state_vars))) + "\n  }\n}"
    
    with open('src/hooks/useAdminData.js', 'w') as out:
        out.write("import { useEffect, useMemo, useState } from 'react'\n")
        out.write("import {\n  onAuthStateChanged,\n  GoogleAuthProvider,\n  signInWithPopup,\n  signInWithEmailAndPassword,\n  signOut,\n} from 'firebase/auth'\n")
        out.write("import {\n  addDoc,\n  collection,\n  doc,\n  deleteDoc,\n  getDocs,\n  orderBy,\n  query,\n  serverTimestamp,\n  updateDoc,\n  where,\n  writeBatch,\n} from 'firebase/firestore'\n")
        out.write("import { auth, db } from '../firebase'\n")
        out.write("import { uploadToCloudinary } from '../utils/cloudinary'\n\n")
        
        # Remove old imports from top_part
        top_part_cleaned = re.sub(r"^import.*?\n", "", top_part, flags=re.MULTILINE)
        
        out.write(top_part_cleaned)
        out.write(return_stmt)

print("Done")
