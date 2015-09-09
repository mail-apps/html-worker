call npm config set prefix "%AppData%\npm"

call :checkExist npm
call :checkExist bower
call :checkExist bower-installer
call :checkExist bower-update
call :checkExist npm-check-updates
cmd /k

goto :eof

:checkExist
echo Checking for %~1
where %~1 2>nul 1>nul
if "%errorlevel%" neq "0" (
  echo Installing %~1
  call npm install -g %~1
) else (
  echo %~1 already installed.
)
goto :eof
