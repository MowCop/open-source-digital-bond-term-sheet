## Update Sign-Up Password Instructions & Validation

### Problem
The current sign-up password field only says "Min 8 characters. Account requires admin approval before access." It does not explicitly tell the user to *create* their own password, nor does it mention the number and symbol requirements. There is also no client-side validation for the number/symbol rules.

### Proposed Changes
1. **Update the password helper text** in `src/pages/AuthPage.tsx` to read:
   > "Create your own password. Must be at least 8 characters and include at least one number and one symbol."

2. **Add client-side validation** in the `submit` handler before calling `signUp`:
   - Check `/\d/` for at least one number.
   - Check `/[^A-Za-z0-9]/` for at least one symbol.
   - If either check fails, show a toast error and abort submission.

3. **Update the `Label`** from "Password" to "Create password" for extra clarity.

### Files Modified
- `src/pages/AuthPage.tsx`

### No backend changes required
Supabase Auth handles the 8-character minimum via the `minLength` attribute; the number/symbol checks will be enforced client-side before the API call.