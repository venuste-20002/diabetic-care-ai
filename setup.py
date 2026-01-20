#!/usr/bin/env python3
"""
Setup script for GlucoGuard AI Chat System
"""

import os
import sys
import subprocess

def install_requirements():
    """Install required packages"""
    try:
        subprocess.run([sys.executable, "-m", "pip", "install", "-r", "requirements.txt"], check=True)
        print("✅ Requirements installed successfully")
    except subprocess.CalledProcessError as e:
        print(f"❌ Error installing requirements: {e}")
        sys.exit(1)

def main():
    """Main setup function"""
    print("🚀 Setting up GlucoGuard AI Chat System...")
    
    # Install requirements
    install_requirements()
    
    print("✅ Setup complete! You can now run the AI chat system.")

if __name__ == "__main__":
    install_requirements()
