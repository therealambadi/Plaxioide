#!/bin/bash

# Exit on error
set -e

# Check platform
platform=$(uname)

if [[ "$platform" == "Darwin" ]]; then
    echo "Running on macOS. Note that the AppImage created will only work on Linux systems."
    if ! command -v docker &> /dev/null; then
        echo "Docker Desktop for Mac is not installed. Please install it from https://www.docker.com/products/docker-desktop"
        exit 1
    fi
elif [[ "$platform" == "Linux" ]]; then
    echo "Running on Linux. Proceeding with AppImage creation..."
else
    echo "This script is intended to run on macOS or Linux. Current platform: $platform"
    exit 1
fi

# Enable BuildKit
export DOCKER_BUILDKIT=1

BUILD_IMAGE_NAME="plaxio-appimage-builder"

# Check if Docker is running
if ! docker info >/dev/null 2>&1; then
    echo "Docker is not running. Please start Docker first."
    exit 1
fi

# Check and install Buildx if needed
if ! docker buildx version >/dev/null 2>&1; then
    echo "Installing Docker Buildx..."
    mkdir -p ~/.docker/cli-plugins/
    curl -SL https://github.com/docker/buildx/releases/download/v0.13.1/buildx-v0.13.1.linux-amd64 -o ~/.docker/cli-plugins/docker-buildx
    chmod +x ~/.docker/cli-plugins/docker-buildx
fi

# Download appimagetool if not present
if [ ! -f "appimagetool" ]; then
    echo "Downloading appimagetool..."
    wget -O appimagetool "https://github.com/AppImage/AppImageKit/releases/download/continuous/appimagetool-x86_64.AppImage"
    chmod +x appimagetool
fi

# Delete any existing AppImage to avoid bloating the build
rm -f Plaxio-x86_64.AppImage

# Create build Dockerfile
echo "Creating build Dockerfile..."
cat > Dockerfile.build << 'EOF'
# syntax=docker/dockerfile:1
FROM ubuntu:20.04

# Install required dependencies
RUN apt-get update && apt-get install -y \
    libfuse2 \
    libglib2.0-0 \
    libgtk-3-0 \
    libx11-xcb1 \
    libxss1 \
    libxtst6 \
    libnss3 \
    libasound2 \
    libdrm2 \
    libgbm1 \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app
EOF

# Create .dockerignore file
echo "Creating .dockerignore file..."
cat > .dockerignore << EOF
Dockerfile.build
.dockerignore
.git
.gitignore
.DS_Store
*~
*.swp
*.swo
*.tmp
*.bak
*.log
*.err
node_modules/
venv/
*.egg-info/
*.tox/
dist/
EOF

# Build Docker image without cache
echo "Building Docker image (no cache)..."
docker build --no-cache -t "$BUILD_IMAGE_NAME" -f Dockerfile.build .

# Create AppImage using local appimagetool
echo "Creating AppImage..."
docker run --rm --privileged -v "$(pwd):/app" "$BUILD_IMAGE_NAME" bash -c '
cd /app && \
rm -rf PlaxioApp.AppDir && \
mkdir -p PlaxioApp.AppDir/usr/bin PlaxioApp.AppDir/usr/lib PlaxioApp.AppDir/usr/share/applications && \
find . -maxdepth 1 ! -name PlaxioApp.AppDir ! -name "." ! -name ".." -exec cp -r {} PlaxioApp.AppDir/usr/bin/ \; && \
cp plaxio.png PlaxioApp.AppDir/ && \
echo "[Desktop Entry]" > PlaxioApp.AppDir/plaxio.desktop && \
echo "Name=Plaxio" >> PlaxioApp.AppDir/plaxio.desktop && \
echo "Comment=PLC Programming IDE with AI and Formal Verification" >> PlaxioApp.AppDir/plaxio.desktop && \
echo "GenericName=PLC IDE" >> PlaxioApp.AppDir/plaxio.desktop && \
echo "Exec=plaxio %F" >> PlaxioApp.AppDir/plaxio.desktop && \
echo "Icon=plaxio" >> PlaxioApp.AppDir/plaxio.desktop && \
echo "Type=Application" >> PlaxioApp.AppDir/plaxio.desktop && \
echo "StartupNotify=false" >> PlaxioApp.AppDir/plaxio.desktop && \
echo "StartupWMClass=Plaxio" >> PlaxioApp.AppDir/plaxio.desktop && \
echo "Categories=Development;IDE;Engineering;" >> PlaxioApp.AppDir/plaxio.desktop && \
echo "MimeType=application/x-plaxio-workspace;" >> PlaxioApp.AppDir/plaxio.desktop && \
echo "Keywords=plaxio;plc;automation;ladder;structured-text;" >> PlaxioApp.AppDir/plaxio.desktop && \
echo "Actions=new-empty-window;" >> PlaxioApp.AppDir/plaxio.desktop && \
echo "[Desktop Action new-empty-window]" >> PlaxioApp.AppDir/plaxio.desktop && \
echo "Name=New Empty Window" >> PlaxioApp.AppDir/plaxio.desktop && \
echo "Exec=plaxio --new-window %F" >> PlaxioApp.AppDir/plaxio.desktop && \
echo "Icon=plaxio" >> PlaxioApp.AppDir/plaxio.desktop && \
chmod +x PlaxioApp.AppDir/plaxio.desktop && \
cp PlaxioApp.AppDir/plaxio.desktop PlaxioApp.AppDir/usr/share/applications/ && \
echo "[Desktop Entry]" > PlaxioApp.AppDir/plaxio-url-handler.desktop && \
echo "Name=Plaxio - URL Handler" >> PlaxioApp.AppDir/plaxio-url-handler.desktop && \
echo "Comment=PLC Programming IDE" >> PlaxioApp.AppDir/plaxio-url-handler.desktop && \
echo "GenericName=PLC IDE" >> PlaxioApp.AppDir/plaxio-url-handler.desktop && \
echo "Exec=plaxio --open-url %U" >> PlaxioApp.AppDir/plaxio-url-handler.desktop && \
echo "Icon=plaxio" >> PlaxioApp.AppDir/plaxio-url-handler.desktop && \
echo "Type=Application" >> PlaxioApp.AppDir/plaxio-url-handler.desktop && \
echo "NoDisplay=true" >> PlaxioApp.AppDir/plaxio-url-handler.desktop && \
echo "StartupNotify=true" >> PlaxioApp.AppDir/plaxio-url-handler.desktop && \
echo "Categories=Utility;Development;IDE;Engineering;" >> PlaxioApp.AppDir/plaxio-url-handler.desktop && \
echo "MimeType=x-scheme-handler/plaxio;" >> PlaxioApp.AppDir/plaxio-url-handler.desktop && \
echo "Keywords=plaxio;" >> PlaxioApp.AppDir/plaxio-url-handler.desktop && \
chmod +x PlaxioApp.AppDir/plaxio-url-handler.desktop && \
cp PlaxioApp.AppDir/plaxio-url-handler.desktop PlaxioApp.AppDir/usr/share/applications/ && \
echo "#!/bin/bash" > PlaxioApp.AppDir/AppRun && \
echo "HERE=\$(dirname \"\$(readlink -f \"\${0}\")\")" >> PlaxioApp.AppDir/AppRun && \
echo "export PATH=\${HERE}/usr/bin:\${PATH}" >> PlaxioApp.AppDir/AppRun && \
echo "export LD_LIBRARY_PATH=\${HERE}/usr/lib:\${LD_LIBRARY_PATH}" >> PlaxioApp.AppDir/AppRun && \
echo "exec \${HERE}/usr/bin/plaxio --no-sandbox \"\$@\"" >> PlaxioApp.AppDir/AppRun && \
chmod +x PlaxioApp.AppDir/AppRun && \
chmod -R 755 PlaxioApp.AppDir && \

# Strip unneeded symbols from the binary to reduce size
strip --strip-unneeded PlaxioApp.AppDir/usr/bin/plaxio

ls -la PlaxioApp.AppDir/ && \
ARCH=x86_64 ./appimagetool -n PlaxioApp.AppDir Plaxio-x86_64.AppImage
'

# Clean up
rm -rf PlaxioApp.AppDir .dockerignore appimagetool

echo "AppImage creation complete! Your AppImage is: Plaxio-x86_64.AppImage"
