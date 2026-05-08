import pandas as pd
import os

excel_path = r'c:\Users\carlos.milla\OneDrive - Tegra\Desktop\AlphaColorMacht2\nombres colores\base de datos.xlsx'

try:
    # Intentamos leer el excel (probablemente necesite openpyxl)
    df = pd.read_excel(excel_path)
    df = df.fillna('')
    
    groups = {}
    for _, row in df.iterrows():
        # Asumimos que Columna 0 es Nombre y Columna 1 es ID (Código NK)
        name = str(row.iloc[0]).strip()
        id_val = str(row.iloc[1]).strip()
        
        if id_val and name:
            if id_val not in groups:
                groups[id_val] = []
            if name not in groups[id_val]:
                groups[id_val].append(name)

    print("TRUNCATE TABLE equivalencias;")
    print("INSERT INTO equivalencias (grupo_id, colores) VALUES")
    
    entries = []
    for gid, names in groups.items():
        # Escapar comillas simples para SQL
        clean_names = [n.replace("'", "''") for n in names]
        names_sql = ", ".join([f"'{n}'" for n in clean_names])
        entries.append(f"('{gid}', ARRAY[{names_sql}])")
    
    print(",\n".join(entries) + ";")

except Exception as e:
    print(f"Error: {e}")
