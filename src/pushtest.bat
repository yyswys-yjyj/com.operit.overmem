@echo off
call adb connect 127.0.0.1:58526
call ./build.bat
call python ../tools/debug_toolpkg.py D:\Projects_en\Operit\Overmem
echo done
pause