import subprocess
import os
import sys
import threading

def run_backend():
    print("Iniciando Backend (Django)...")
    # Cambia al directorio del backend y ejecuta el servidor
    backend_dir = os.path.join(os.path.dirname(__file__), "backend")
    
    # Determinar el ejecutable de python dentro del entorno virtual
    if os.name == 'nt':
        python_exe = os.path.join(backend_dir, "venv", "Scripts", "python.exe")
    else:
        python_exe = os.path.join(backend_dir, "venv", "bin", "python")
        
    manage_py = os.path.join(backend_dir, "manage.py")
    
    try:
        process = subprocess.Popen(
            [python_exe, manage_py, "runserver"],
            cwd=backend_dir,
            stdout=sys.stdout,
            stderr=sys.stderr
        )
        process.wait()
    except Exception as e:
        print(f"Error al iniciar el backend: {e}")

def run_frontend():
    print("Iniciando Frontend (Vite/React)...")
    # Cambia al directorio del frontend y ejecuta el servidor
    frontend_dir = os.path.join(os.path.dirname(__file__), "frontend")
    
    npm_cmd = "npm.cmd" if os.name == 'nt' else "npm"
    
    try:
        process = subprocess.Popen(
            [npm_cmd, "run", "dev"],
            cwd=frontend_dir,
            stdout=sys.stdout,
            stderr=sys.stderr
        )
        process.wait()
    except Exception as e:
        print(f"Error al iniciar el frontend: {e}")

if __name__ == "__main__":
    t_backend = threading.Thread(target=run_backend)
    t_frontend = threading.Thread(target=run_frontend)

    t_backend.start()
    t_frontend.start()

    try:
        t_backend.join()
        t_frontend.join()
    except KeyboardInterrupt:
        print("\nServidores detenidos por el usuario.")
        sys.exit(0)
