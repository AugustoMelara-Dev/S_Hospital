#Requires -Version 7.0
[CmdletBinding()]
param(
    [Parameter(Mandatory=$true)][string]$PayloadRoot,
    [Parameter(Mandatory=$true)][string]$EvidenceRoot,
    [Parameter(Mandatory=$true)][string]$BuilderReceipt,
    [int]$DatabasePort=43317,[int]$PhpPort=49080,[int]$HttpPort=48090
)
$ErrorActionPreference='Stop'; Set-StrictMode -Version Latest
. (Join-Path $PSScriptRoot 'lib\native_manifest.ps1')

function Slash([string]$p){$p.Replace('\','/')}
function Wait-Port([int]$port){foreach($n in 1..60){$c=[Net.Sockets.TcpClient]::new();try{if($c.ConnectAsync('127.0.0.1',$port).Wait(500)-and$c.Connected){return}}catch{}finally{$c.Dispose()};Start-Sleep -Milliseconds 500};throw "Port $port not ready"}
function Run([string]$file,[string[]]$arguments,[string]$cwd,[string]$log){Push-Location $cwd;try{$o=@(& $file @arguments 2>&1);$code=$LASTEXITCODE;$o|Set-Content -LiteralPath $log -Encoding UTF8;if($code-ne0){throw "Command failed ($code): $file; $log"};$o}finally{Pop-Location}}
function Stop-One($p){if($null-ne$p-and$null-ne(Get-Process -Id $p.Id -ErrorAction SilentlyContinue)){Stop-Process -Id $p.Id -Force;Wait-Process -Id $p.Id -Timeout 10 -ErrorAction SilentlyContinue}}
function Query-Database([string]$sql,[string]$log){((Run (Join-Path $maria 'bin\mariadb.exe') @("--defaults-extra-file=$appIni",'--batch','--skip-column-names','--execute',$sql) $sandbox (Join-Path $evidence $log))-join'').Trim()}
function Protect-Root([string]$path){$acl=New-Object Security.AccessControl.DirectorySecurity;$acl.SetAccessRuleProtection($true,$false);$sid=[Security.Principal.WindowsIdentity]::GetCurrent().User;$rule=New-Object Security.AccessControl.FileSystemAccessRule($sid,'FullControl','ContainerInherit,ObjectInherit','None','Allow');[void]$acl.AddAccessRule($rule);Set-Acl -LiteralPath $path -AclObject $acl}
function New-LayeredRelease([string]$source,[string]$destination,[string]$marker){
 New-Item -ItemType Directory -Path (Join-Path $destination 'app\backend'),(Join-Path $destination app) -Force|Out-Null
 foreach($directory in @('app','bootstrap','config','database','public','resources','routes')){Copy-Item -LiteralPath (Join-Path $source ('app\backend\'+$directory)) -Destination (Join-Path $destination 'app\backend') -Recurse}
 foreach($file in @('artisan','composer.json','composer.lock')){Copy-Item -LiteralPath (Join-Path $source ('app\backend\'+$file)) -Destination (Join-Path $destination 'app\backend')}
 $sourceVendor=Join-Path $source 'app\backend\vendor';$layeredVendor=Join-Path $destination 'app\backend\vendor';New-Item -ItemType Directory -Path $layeredVendor|Out-Null
 Copy-Item -LiteralPath (Join-Path $sourceVendor composer) -Destination $layeredVendor -Recurse
 foreach($vendorEntry in @(Get-ChildItem -LiteralPath $sourceVendor -Force|Where-Object Name -ne composer)){if($vendorEntry.PSIsContainer){New-Item -ItemType Junction -Path (Join-Path $layeredVendor $vendorEntry.Name) -Target $vendorEntry.FullName|Out-Null}else{Copy-Item -LiteralPath $vendorEntry.FullName -Destination $layeredVendor}}
 Copy-Item -LiteralPath (Join-Path $source 'app\frontend') -Destination (Join-Path $destination app) -Recurse
 New-Item -ItemType Junction -Path (Join-Path $destination runtime) -Target (Join-Path $source runtime)|Out-Null
 New-Item -ItemType Junction -Path (Join-Path $destination scripts) -Target (Join-Path $source scripts)|Out-Null
 foreach($file in @('native-release.json','native-runtime-probe.json','native-payload.manifest.json')){Copy-Item -LiteralPath (Join-Path $source $file) -Destination $destination}
 if($marker-ne''){$manifestPath=Join-Path $destination 'native-payload.manifest.json';$manifest=Get-Content $manifestPath -Raw|ConvertFrom-Json;$index=Join-Path $destination 'app\frontend\dist\index.html';Add-Content -LiteralPath $index -Value "<!-- $marker -->";$user=Join-Path $destination 'app\backend\app\Models\User.php';$userText=Get-Content $user -Raw;$userText=$userText-replace '(class User extends Authenticatable\s*\{)',("`$1`r`n    public const NATIVE_UPGRADE_BUILD_MARKER = '"+$marker+"';");[IO.File]::WriteAllText($user,$userText,[Text.UTF8Encoding]::new($false));foreach($relative in @('app/frontend/dist/index.html','app/backend/app/Models/User.php')){$file=Join-Path $destination $relative.Replace('/','\');$entry=@($manifest.files|Where-Object { $_.path -eq $relative });if($entry.Count-ne1){throw "Layered release manifest entry missing: $relative"};$item=Get-Item $file;$entry[0].bytes=[int64]$item.Length;$entry[0].sha256=(Get-FileHash $file -Algorithm SHA256).Hash.ToLowerInvariant()};$manifest|ConvertTo-Json -Depth 6|Set-Content $manifestPath -Encoding UTF8}
 # The builder validates every payload byte once before this drill. Layering is
 # local test scaffolding: verify only the files intentionally changed here and
 # rely on the copied manifest for the immutable/shared runtime content.
 if($marker-ne''){foreach($relative in @('app/frontend/dist/index.html','app/backend/app/Models/User.php')){$file=Join-Path $destination $relative.Replace('/','\');$manifest=Get-Content (Join-Path $destination 'native-payload.manifest.json') -Raw|ConvertFrom-Json;$entry=@($manifest.files|Where-Object { $_.path -eq $relative });if($entry.Count-ne1-or(Get-FileHash $file -Algorithm SHA256).Hash.ToLowerInvariant()-ne([string]$entry[0].sha256).ToLowerInvariant()){throw "Layered release changed-file verification failed: $relative"}}}
}

$payload=(Resolve-Path -LiteralPath $PayloadRoot).Path
$manifestPath=Join-Path $payload 'native-payload.manifest.json';$releasePath=Join-Path $payload 'native-release.json'
if(-not(Test-Path $manifestPath -PathType Leaf)-or-not(Test-Path $releasePath -PathType Leaf)){throw 'Builder-validated payload metadata is missing'}
$manifestMetadata=Get-Content $manifestPath -Raw|ConvertFrom-Json;$releaseMetadata=Get-Content $releasePath -Raw|ConvertFrom-Json
if([string]$manifestMetadata.version-ne[string]$releaseMetadata.version){throw 'Payload manifest and release metadata versions differ'}
$payloadIdentity=Get-NativePayloadIdentity $payload
$receiptPath=(Resolve-Path -LiteralPath $BuilderReceipt).Path;$receipt=Get-Content $receiptPath -Raw|ConvertFrom-Json;$manifestSha=(Get-FileHash $manifestPath -Algorithm SHA256).Hash.ToLowerInvariant()
if($receipt.status-ne'passed'-or$receipt.validator-ne'build_native_payload.ps1/Test-NativePayloadManifest'-or[IO.Path]::GetFullPath([string]$receipt.payload_root)-ne$payload-or$receipt.version-ne$payloadIdentity.Version-or[int]$receipt.files_checked-ne@($manifestMetadata.files).Count-or$receipt.manifest_sha256-ne$manifestSha-or$receipt.content_sha256-ne$payloadIdentity.ContentSha256-or$receipt.release_id-ne$payloadIdentity.ReleaseId){throw 'Builder full-validation receipt does not identify this exact payload'}
$codeHashes=[ordered]@{}
foreach($relative in @('lib\native_manifest.ps1','lib\native_cache.ps1','lib\native_update_engine.ps1','lib\native_update_policy.ps1','update_native_runtime.ps1')){$sourceScript=Join-Path $PSScriptRoot $relative;$payloadScript=Join-Path (Join-Path $payload 'scripts\native') $relative;$sourceHash=(Get-FileHash $sourceScript -Algorithm SHA256).Hash.ToLowerInvariant();$payloadHash=(Get-FileHash $payloadScript -Algorithm SHA256).Hash.ToLowerInvariant();if($sourceHash-ne$payloadHash){throw "Harness source and payload runtime differ: $relative"};$codeHashes[$relative.Replace('\','/')]=$payloadHash}
$codeHashes['verify_native_upgrade_sandbox.ps1']=(Get-FileHash $PSCommandPath -Algorithm SHA256).Hash.ToLowerInvariant()
. (Join-Path $payload 'scripts\native\lib\native_cache.ps1')
. (Join-Path $payload 'scripts\native\lib\native_update_engine.ps1')
. (Join-Path $payload 'scripts\native\lib\native_update_policy.ps1')
$evidence=[IO.Path]::GetFullPath($EvidenceRoot);New-Item -ItemType Directory -Path $evidence -Force|Out-Null
$sandbox=Join-Path ([IO.Path]::GetFullPath((Join-Path $payload '..'))) ('native-upgrade-sandbox-'+[guid]::NewGuid().ToString('N'))
New-Item -ItemType Directory -Path $sandbox|Out-Null;Protect-Root $sandbox
$install=Join-Path $sandbox program;$data=Join-Path $sandbox data;$releases=Join-Path $install releases;$current=Join-Path $install current
$old=$null;$new=$null;$oldIdentity=$null;$newIdentity=$null;$maria=Join-Path $payload 'runtime\mariadb'
$mariaProcess=$null;$script:php=$null;$script:caddy=$null;$script:seq=0
$processes=[Collections.Generic.List[object]]::new();$phases=[Collections.Generic.List[string]]::new();$backups=[Collections.Generic.List[object]]::new()
$result=[ordered]@{status='running';started_at_utc=(Get-Date).ToUniversalTime().ToString('o');sandbox_root=$sandbox;ports=[ordered]@{mariadb=$DatabasePort;php=$PhpPort;http=$HttpPort}}
try{
 foreach($d in @('program/releases','data/database','data/config/php-scan-disabled','data/storage/app/private','data/storage/framework/cache/data','data/storage/framework/sessions','data/storage/framework/views','data/storage/logs','data/cache/views','data/logs','data/backups')){New-Item -ItemType Directory -Path (Join-Path $sandbox $d)-Force|Out-Null}
 $visibleVersion=[string](Get-Content (Join-Path $payload 'native-release.json') -Raw|ConvertFrom-Json).version;$oldCandidate=Join-Path $sandbox old-layer;$newCandidate=Join-Path $sandbox new-layer;New-LayeredRelease $payload $oldCandidate 'native-upgrade-old-release';New-LayeredRelease $payload $newCandidate ''
 $oldIdentity=Get-NativePayloadIdentity $oldCandidate;$newIdentity=Get-NativePayloadIdentity $newCandidate;if($oldIdentity.Version-ne$newIdentity.Version-or$oldIdentity.ReleaseId-eq$newIdentity.ReleaseId){throw 'Same-version corrected payload identity contract failed'}
 $old=Join-Path $releases $oldIdentity.ReleaseId;$new=Join-Path $releases $newIdentity.ReleaseId;Move-Item -LiteralPath $oldCandidate -Destination $old;Move-Item -LiteralPath $newCandidate -Destination $new;New-Item -ItemType Junction -Path $current -Target $old|Out-Null
 $probeTemplate='require ''{0}''; $r=new ReflectionClass(App\Models\User::class); echo json_encode([''file''=>$r->getFileName(),''marker''=>$r->hasConstant(''NATIVE_UPGRADE_BUILD_MARKER'')?$r->getConstant(''NATIVE_UPGRADE_BUILD_MARKER''):''candidate'']);';$reflectionCodeOld=$probeTemplate-f(Slash (Join-Path $old 'app\backend\vendor\autoload.php'));$reflectionCodeNew=$probeTemplate-f(Slash (Join-Path $new 'app\backend\vendor\autoload.php'))
 $oldProbe=((Run (Join-Path $old 'runtime\php\php.exe') @('-r',$reflectionCodeOld) $sandbox (Join-Path $evidence 'upgrade-old-autoload-probe.log')-join'').Trim()|ConvertFrom-Json);$newProbe=((Run (Join-Path $new 'runtime\php\php.exe') @('-r',$reflectionCodeNew) $sandbox (Join-Path $evidence 'upgrade-new-autoload-probe.log')-join'').Trim()|ConvertFrom-Json);$oldClassPath=[string]$oldProbe.file;$newClassPath=[string]$newProbe.file
 if(-not[IO.Path]::GetFullPath($oldClassPath).StartsWith(([IO.Path]::GetFullPath($old).TrimEnd('\')+'\'),[StringComparison]::OrdinalIgnoreCase)-or-not[IO.Path]::GetFullPath($newClassPath).StartsWith(([IO.Path]::GetFullPath($new).TrimEnd('\')+'\'),[StringComparison]::OrdinalIgnoreCase)){throw 'Composer autoload escaped its layered release'}
 if($oldProbe.marker-ne'native-upgrade-old-release'-or$newProbe.marker-ne'candidate'-or(Get-FileHash $oldClassPath -Algorithm SHA256).Hash-eq(Get-FileHash $newClassPath -Algorithm SHA256).Hash){throw 'Old and candidate backend code probes are not observably different'}

 # Same compatibility function used by the updater: default rejects; reviewed additive permits.
 $po=Join-Path $sandbox policy-old;$pn=Join-Path $sandbox policy-new;New-Item -ItemType Directory -Path $po,$pn|Out-Null
 Set-Content (Join-Path $po 0001.php) '<?php return true;' -Encoding ASCII;Copy-Item (Join-Path $po 0001.php) (Join-Path $pn 0001.php);Set-Content (Join-Path $pn 0002.php) '<?php return true;' -Encoding ASCII
 $defaultRejected=$false;try{Test-NativeDatabaseUpdateCompatibility $po $pn no_schema_change|Out-Null}catch{$defaultRejected=$_.Exception.Message-match'not declared backward-compatible additive'}
 if(-not$defaultRejected){throw 'Default policy accepted new migration'};$policy=Test-NativeDatabaseUpdateCompatibility $po $pn backward_compatible_additive

 $rootPass=[guid]::NewGuid().ToString('N')+[guid]::NewGuid().ToString('N');$appPass=[guid]::NewGuid().ToString('N')+[guid]::NewGuid().ToString('N');$schema='shospital_native_upgrade'
 $my=Join-Path $data 'config\my.ini';@"
[mysqld]
basedir=$(Slash $maria)
datadir=$(Slash (Join-Path $data database))
port=$DatabasePort
bind-address=127.0.0.1
skip-name-resolve
character-set-server=utf8mb4
collation-server=utf8mb4_unicode_ci
log-error=$(Slash (Join-Path $data 'logs\mariadb-error.log'))
[client]
host=127.0.0.1
port=$DatabasePort
protocol=tcp
"@|Set-Content $my -Encoding UTF8
 Run (Join-Path $maria 'bin\mariadb-install-db.exe') @("--datadir=$(Join-Path $data database)","--password=$rootPass","--port=$DatabasePort","--config=$my",'--silent') $sandbox (Join-Path $evidence 'upgrade-mariadb-initialize.log')|Out-Null
 $mariaProcess=Start-Process (Join-Path $maria 'bin\mariadbd.exe') -ArgumentList @("--defaults-file=$my",'--console') -WorkingDirectory $sandbox -WindowStyle Hidden -RedirectStandardOutput (Join-Path $evidence 'upgrade-mariadb.stdout.log') -RedirectStandardError (Join-Path $evidence 'upgrade-mariadb.stderr.log') -PassThru;$processes.Add([pscustomobject]@{role='mariadb';pid=$mariaProcess.Id});Wait-Port $DatabasePort
 $admin=Join-Path $data 'config\admin.ini';"[client]`nuser=root`npassword=$rootPass`nhost=127.0.0.1`nport=$DatabasePort`nprotocol=tcp"|Set-Content $admin
 $sql="CREATE DATABASE ``$schema`` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci; CREATE USER 'hospital_upgrade'@'127.0.0.1' IDENTIFIED BY '$appPass'; GRANT ALL PRIVILEGES ON ``$schema``.* TO 'hospital_upgrade'@'127.0.0.1'; FLUSH PRIVILEGES;"
 Run (Join-Path $maria 'bin\mariadb.exe') @("--defaults-extra-file=$admin",'--execute',$sql) $sandbox (Join-Path $evidence 'upgrade-database-bootstrap.log')|Out-Null
 $appIni=Join-Path $data 'config\app.ini';"[client]`nuser=hospital_upgrade`npassword=$appPass`nhost=127.0.0.1`nport=$DatabasePort`nprotocol=tcp`ndatabase=$schema"|Set-Content $appIni

 $random=[byte[]]::new(32);[Security.Cryptography.RandomNumberGenerator]::Fill($random);$phpIni=Join-Path $data 'config\php.ini'
 @"
[PHP]
display_errors=Off
log_errors=On
extension_dir="$(Slash (Join-Path $current 'runtime\php\ext'))"
session.save_path="$(Slash (Join-Path $data 'storage\framework\sessions'))"
extension=curl
extension=fileinfo
extension=gd
extension=intl
extension=mbstring
extension=openssl
extension=pdo_mysql
extension=sodium
extension=zip
zend_extension=opcache
opcache.enable=1
opcache.validate_timestamps=0
"@|Set-Content $phpIni -Encoding UTF8
 $envs=[ordered]@{APP_NAME='S_Hospital';APP_ENV='production';APP_KEY='base64:'+[Convert]::ToBase64String($random);APP_DEBUG='false';APP_URL="http://127.0.0.1:$HttpPort";SANCTUM_STATEFUL_DOMAINS="127.0.0.1:$HttpPort";LOG_CHANNEL='stack';LOG_LEVEL='warning';DB_CONNECTION='mysql';DB_HOST='127.0.0.1';DB_PORT=[string]$DatabasePort;DB_DATABASE=$schema;DB_USERNAME='hospital_upgrade';DB_APP_ACCOUNT_HOST='127.0.0.1';DB_PASSWORD=$appPass;SESSION_DRIVER='file';CACHE_STORE='database';QUEUE_CONNECTION='database';BROADCAST_CONNECTION='null';FILESYSTEM_DISK='local';HOSPITAL_ALLOW_INSECURE_HTTP='1';HOSPITAL_NATIVE_DATA_ROOT=$data;LARAVEL_STORAGE_PATH=(Join-Path $data storage);APP_CONFIG_CACHE=(Join-Path $data 'cache\config.php');APP_EVENTS_CACHE=(Join-Path $data 'cache\events.php');APP_PACKAGES_CACHE=(Join-Path $data 'cache\packages.php');APP_ROUTES_CACHE=(Join-Path $data 'cache\routes.php');APP_SERVICES_CACHE=(Join-Path $data 'cache\services.php');VIEW_COMPILED_PATH=(Join-Path $data 'cache\views');HOSPITAL_DUMP_BINARY=(Join-Path $maria 'bin\mariadb-dump.exe');HOSPITAL_BACKUP_ENCRYPTION_KEY=[Convert]::ToBase64String($random);HOSPITAL_DAILY_BACKUP_TIME='23:58';HOSPITAL_OPERATION_START='00:01';HOSPITAL_OPERATION_END='00:02';PHPRC=$phpIni;PHP_INI_SCAN_DIR=(Join-Path $data 'config\php-scan-disabled');PHP_FCGI_MAX_REQUESTS='0'}
 foreach($e in $envs.GetEnumerator()){[Environment]::SetEnvironmentVariable($e.Key,[string]$e.Value,'Process')};$envFile=Join-Path $data 'config\hospital.env';$envs.GetEnumerator()|%{"$($_.Key)=$($_.Value)"}|Set-Content $envFile;$configHash=(Get-FileHash $envFile -Algorithm SHA256).Hash

 function Current-Artisan([string[]]$a,[string]$log){Run (Join-Path $current 'runtime\php\php.exe') (@('-c',$phpIni,'artisan')+$a) (Join-Path $current 'app\backend') (Join-Path $evidence $log)}
 function Candidate-Artisan([string[]]$a,[string]$log){Run (Join-Path $new 'runtime\php\php.exe') (@('-c',$phpIni,'artisan')+$a) (Join-Path $new 'app\backend') (Join-Path $evidence $log)}
 function Http-Healthy{try{(Invoke-WebRequest "http://127.0.0.1:$HttpPort/up" -UseBasicParsing -TimeoutSec 10).StatusCode-eq200}catch{$false}}
 function Old-Marker-Served{try{$response=Invoke-WebRequest "http://127.0.0.1:$HttpPort/login" -UseBasicParsing -TimeoutSec 10;return ([string]$response.Content-match'native-upgrade-old-release')}catch{return $false}}
 function Stop-App{Stop-One $script:caddy;Stop-One $script:php;$script:caddy=$null;$script:php=$null}
 function Start-App{$script:seq++;$s='{0:D2}'-f$script:seq;$script:php=Start-Process (Join-Path $current 'runtime\php\php-cgi.exe') -ArgumentList @('-c',$phpIni,'-b',"127.0.0.1:$PhpPort") -WorkingDirectory (Join-Path $current 'app\backend') -WindowStyle Hidden -RedirectStandardOutput (Join-Path $evidence "upgrade-php-$s.out.log") -RedirectStandardError (Join-Path $evidence "upgrade-php-$s.err.log") -PassThru;$processes.Add([pscustomobject]@{role="php-$s";pid=$script:php.Id});Wait-Port $PhpPort;$cf=Join-Path $data 'config\Caddyfile';@"
{
  auto_https off
  admin off
}
http://127.0.0.1:$HttpPort {
 root * "$(Slash (Join-Path $current 'app\backend\public'))"
 php_fastcgi 127.0.0.1:$PhpPort {
  try_files {path} /index.php
 }
 file_server
}
"@|Set-Content $cf;$script:caddy=Start-Process (Join-Path $current 'runtime\caddy\caddy.exe') -ArgumentList @('run','--config',$cf,'--adapter','caddyfile') -WorkingDirectory (Join-Path $current 'app\backend') -WindowStyle Hidden -RedirectStandardOutput (Join-Path $evidence "upgrade-caddy-$s.out.log") -RedirectStandardError (Join-Path $evidence "upgrade-caddy-$s.err.log") -PassThru;$processes.Add([pscustomobject]@{role="caddy-$s";pid=$script:caddy.Id});Wait-Port $HttpPort}

 Current-Artisan @('migrate','--force','--no-interaction') 'upgrade-initial-migrate.log'|Out-Null;Current-Artisan @('db:seed','--class=ProductionInstallationSeeder','--force','--no-interaction') 'upgrade-initial-seed.log'|Out-Null
 $financialFixture=Join-Path $sandbox 'create-financial-fixture.php';@'
<?php
$backend = getenv('NATIVE_BACKEND');
require $backend.'/vendor/autoload.php';
$app = require $backend.'/bootstrap/app.php';
$app->make(Illuminate\Contracts\Console\Kernel::class)->bootstrap();
$settings = App\Models\FiscalSetting::query()->first() ?? new App\Models\FiscalSetting();
$settings->fill(['hospital_name'=>'Hospital Sandbox','rtn'=>'08011999123456','default_tax_rate'=>'15.00','receipt_template_mode'=>'institutional','receipt_paper_size'=>'half_letter']);
$settings->save();
App\Models\FiscalSequence::query()->create(['document_type'=>'invoice','prefix'=>'000-001-01','min_number'=>1,'max_number'=>99999999,'current_number'=>0,'cai'=>'SANDBOX-CAI','valid_until'=>now()->addYear()->toDateString(),'active'=>true]);
$user = App\Models\User::query()->create(['name'=>'Cajero Sandbox','username'=>'sandbox_cashier','email'=>'sandbox@example.invalid','password'=>'Synthetic-Only-Password-19!','active'=>true,'must_change_password'=>false]);
$user->assignRole('cajero');
$session = app(App\Actions\Cash\OpenCashSessionAction::class)->execute(['opening_amount'=>'500.00'], $user->fresh());
$service = App\Models\Service::query()->where('active',true)->where('visible_in_billing',true)->where('is_billable',true)->where('price','>',0)->orderBy('id')->firstOrFail();
$invoice = app(App\Actions\Billing\CreateInvoiceAction::class)->execute(['patient_name'=>'Paciente Histórico Sandbox','items'=>[['service_id'=>$service->id,'quantity'=>'2.00']]], $user->fresh());
$payment = app(App\Actions\Payments\RegisterPaymentAction::class)->execute($invoice,['cash_session_id'=>$session->id,'method'=>App\Models\Payment::METHOD_CASH,'amount'=>$invoice->balance_due],$user->fresh(),app(App\Support\InvoiceAccess::class));
$item = $invoice->items()->firstOrFail();
echo json_encode(['invoice_id'=>$invoice->id,'invoice_number'=>$invoice->invoice_number,'patient_name'=>$invoice->patient_name,'total_cents'=>$invoice->fresh()->total_cents,'item_id'=>$item->id,'service_name'=>$item->service_name,'quantity_cents'=>$item->quantity_cents,'unit_price_cents'=>$item->unit_price_cents,'line_total_cents'=>$item->line_total_cents,'payment_id'=>$payment->id,'payment_amount_cents'=>$payment->amount_cents], JSON_THROW_ON_ERROR);
'@|Set-Content -LiteralPath $financialFixture -Encoding UTF8
 [Environment]::SetEnvironmentVariable('NATIVE_BACKEND',(Join-Path $current 'app\backend'),'Process');$financial=((Run (Join-Path $current 'runtime\php\php.exe') @('-c',$phpIni,$financialFixture) $sandbox (Join-Path $evidence 'upgrade-financial-fixture.log'))-join'').Trim()|ConvertFrom-Json
 function Financial-Snapshot([string]$log){Query-Database "SELECT i.invoice_number,i.patient_name,i.subtotal_cents,i.tax_amount_cents,i.total_cents,i.paid_amount_cents,i.balance_due_cents,i.status,i.settlement,ii.service_name,ii.quantity_cents,ii.unit_price_cents,ii.line_total_cents,p.amount_cents,p.method,p.status FROM invoices i JOIN invoice_items ii ON ii.invoice_id=i.id JOIN payments p ON p.invoice_id=i.id WHERE i.id=$($financial.invoice_id) AND ii.id=$($financial.item_id) AND p.id=$($financial.payment_id);" $log}
 $financialExpected=Financial-Snapshot 'upgrade-financial-before.log';if([string]::IsNullOrWhiteSpace($financialExpected)-or$financial.total_cents-le0-or$financial.payment_amount_cents-ne$financial.total_cents){throw 'Financial fixture did not create a paid non-zero domain invoice'}
 # Populate valid caches with the previous release. They must be removed while
 # writers are stopped, before the candidate migrates or starts.
 Current-Artisan @('optimize','--no-interaction') 'upgrade-old-optimize.log'|Out-Null;Set-Content -LiteralPath (Join-Path $data 'cache\views\old-release-compiled.php') -Value '<?php /* previous release compiled view */' -Encoding ASCII
 $preUpdateCacheFiles=@(Get-ChildItem -LiteralPath (Join-Path $data cache) -Recurse -File|Select-Object -ExpandProperty FullName);if($preUpdateCacheFiles.Count-eq0){throw 'Previous release did not create persistent Laravel caches for invalidation coverage'}
 Run (Join-Path $maria 'bin\mariadb.exe') @("--defaults-extra-file=$appIni",'--execute',"CREATE TABLE native_upgrade_probe(id INT PRIMARY KEY,marker VARCHAR(64));INSERT INTO native_upgrade_probe VALUES(1,'preserve-me');") $sandbox (Join-Path $evidence 'upgrade-sentinel.log')|Out-Null
 $before=(Run (Join-Path $maria 'bin\mariadb.exe') @("--defaults-extra-file=$appIni",'--batch','--skip-column-names','--execute',"SELECT (SELECT COUNT(*) FROM services),(SELECT COUNT(*) FROM users),(SELECT marker FROM native_upgrade_probe WHERE id=1);") $sandbox (Join-Path $evidence 'upgrade-counts-before.log')-join'').Trim()
 $migration=Join-Path $sandbox '2026_09_28_235959_native_upgrade_compatible.php';@'
<?php
use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;
return new class extends Migration {
 public function up(): void { Schema::create('native_upgrade_compatible', function (Blueprint $table): void { $table->id(); $table->string('marker')->default('compatible'); }); }
 public function down(): void { }
};
'@|Set-Content $migration -Encoding UTF8

 $script:migrated=$false;$script:offlineCacheInvalidated=$false;$prepare={if($null-ne$script:php-or$null-ne$script:caddy){throw 'writers still active'};$n=$backups.Count+1;$b=((Current-Artisan @('hospital:backup','--type=manual','--json') "upgrade-backup-$n.log")-join"`n")|ConvertFrom-Json;$v=((Current-Artisan @('hospital:verify-backup',[string]$b.backup_log_id,'--json') "upgrade-backup-$n-verify.log")-join"`n")|ConvertFrom-Json;if($b.status-ne'success'-or-not$b.encrypted-or$v.status-ne'verified'-or$v.backup_log_id-ne$b.backup_log_id){throw 'exact offline backup verification failed'};$backups.Add([pscustomobject]@{id=$b.backup_log_id;sha256=$b.checksum_sha256;verified=$true});Clear-NativePersistentLaravelCaches -DataRoot $data;if(@(Get-ChildItem -LiteralPath (Join-Path $data cache) -Recurse -File).Count-ne0){throw 'persistent Laravel caches were not empty immediately after offline invalidation'};$script:offlineCacheInvalidated=$true;if(-not$script:migrated){Candidate-Artisan @('migrate',"--path=$migration",'--realpath','--force','--no-interaction') 'upgrade-additive-migration.log'|Out-Null;$script:migrated=$true}}
 $phase={param($name,$pointer,$target)$phases.Add([string]$name)};$stop=${function:Stop-App};$start=${function:Start-App};$health={Http-Healthy}
 Start-App;if(-not(Http-Healthy)){throw 'old release health failed'};$loginResponse=Invoke-WebRequest "http://127.0.0.1:$HttpPort/login" -UseBasicParsing -TimeoutSec 10;$login=$loginResponse.StatusCode;if([string]$loginResponse.Content-notmatch'native-upgrade-old-release'){throw 'Old release marker was not served'};$assetMatch=[regex]::Match([string]$loginResponse.Content,'(?:src|href)="(?<path>/assets/[^"]+)"');if(-not$assetMatch.Success){throw 'Login page did not reference a bundled frontend asset'};$asset=(Invoke-WebRequest ("http://127.0.0.1:$HttpPort"+$assetMatch.Groups['path'].Value) -UseBasicParsing -TimeoutSec 10).StatusCode

 $between=$false;try{Invoke-NativeUpdateActivation $current $new (Join-Path $install 'current.previous-between') (Join-Path $install 'current.next') $releases $stop $prepare $start $health $phase {} {throw 'injected-between-pointer-moves'}|Out-Null}catch{$between=$_.Exception.Message-match'injected-between-pointer-moves'}
 if(-not$between-or(Get-NativeUpdatePointerTarget $current)-ne$old-or-not(Http-Healthy)-or-not(Old-Marker-Served)){throw 'between-moves rollback failed'}
 if((Financial-Snapshot 'upgrade-financial-after-pointer-rollback.log')-ne$financialExpected){throw 'Financial snapshots changed after pointer-move rollback'}
 $script:rejectHealth=$true;$healthFail={$ok=Http-Healthy;if($ok-and$script:rejectHealth-and(Get-NativeUpdatePointerTarget $current)-eq$new){$script:rejectHealth=$false;return $false};$ok};$badHealth=$false
 try{Invoke-NativeUpdateActivation $current $new (Join-Path $install 'current.previous-health') (Join-Path $install 'current.next') $releases $stop $prepare $start $healthFail $phase|Out-Null}catch{$badHealth=$_.Exception.Message-match'did not pass its local health check'}
 if(-not$badHealth-or(Get-NativeUpdatePointerTarget $current)-ne$old-or-not(Http-Healthy)-or-not(Old-Marker-Served)){throw 'health rollback failed'}
 if((Financial-Snapshot 'upgrade-financial-after-health-rollback.log')-ne$financialExpected){throw 'Financial snapshots changed after candidate-health rollback'}
 $activation=Invoke-NativeUpdateActivation $current $new (Join-Path $install 'current.previous-success') (Join-Path $install 'current.next') $releases $stop $prepare $start $health $phase
 if((Get-NativeUpdatePointerTarget $current)-ne$new-or-not(Http-Healthy)){throw 'forward activation failed'}
 $candidateLogin=(Invoke-WebRequest "http://127.0.0.1:$HttpPort/login" -UseBasicParsing -TimeoutSec 10).Content;if([string]$candidateLogin-match'native-upgrade-old-release'){throw 'Candidate still serves old release content'}
 $after=(Run (Join-Path $maria 'bin\mariadb.exe') @("--defaults-extra-file=$appIni",'--batch','--skip-column-names','--execute',"SELECT (SELECT COUNT(*) FROM services),(SELECT COUNT(*) FROM users),(SELECT marker FROM native_upgrade_probe WHERE id=1),(SELECT COUNT(*) FROM native_upgrade_compatible);") $sandbox (Join-Path $evidence 'upgrade-counts-after.log')-join'').Trim()
 if($after-ne($before+"`t0")){throw "data mismatch before=$before after=$after"};if((Get-FileHash $envFile -Algorithm SHA256).Hash-ne$configHash){throw 'configuration changed'}
 if((Financial-Snapshot 'upgrade-financial-after-forward.log')-ne$financialExpected){throw 'Financial snapshots changed after successful activation'}
 # Laravel may lazily recreate packages.php/services.php for the selected
 # release. All executable config/routes/events caches and compiled views from
 # the previous release must be gone.
 $cacheFilesRemaining=@($preUpdateCacheFiles|Where-Object{(Split-Path $_ -Leaf)-notin@('packages.php','services.php')-and(Test-Path -LiteralPath $_)}).Count;if($cacheFilesRemaining-ne0){throw 'persistent previous-release caches remain'}

 # Exercise Laravel's real scheduler path. Only this process receives the due
 # minute; no host schedule, lab database, or persisted operator setting changes.
 $scheduledBefore=[int64](Query-Database 'SELECT COALESCE(MAX(id),0) FROM backup_logs;' 'upgrade-scheduled-before.log')
 $outsideStart=(Get-Date).AddHours(10).ToString('HH:mm');$outsideEnd=(Get-Date).AddHours(11).ToString('HH:mm');[Environment]::SetEnvironmentVariable('HOSPITAL_OPERATION_START',$outsideStart,'Process');[Environment]::SetEnvironmentVariable('HOSPITAL_OPERATION_END',$outsideEnd,'Process')
 $scheduledRow=$null;$schedulerMinute='';$schedulerAttempt=0
 foreach($schedulerAttempt in 1..2){$schedulerMinute=(Get-Date).ToString('HH:mm');[Environment]::SetEnvironmentVariable('HOSPITAL_DAILY_BACKUP_TIME',$schedulerMinute,'Process');Current-Artisan @('schedule:clear-cache','--no-interaction') "upgrade-schedule-clear-cache-$schedulerAttempt.log"|Out-Null;Current-Artisan @('schedule:run','--no-interaction','-v') "upgrade-schedule-run-$schedulerAttempt.log"|Out-Null;foreach($poll in 1..45){$row=Query-Database "SELECT id,status,type,COALESCE(checksum_sha256,''),encrypted,size_bytes FROM backup_logs WHERE id > $scheduledBefore AND type='scheduled' ORDER BY id DESC LIMIT 1;" 'upgrade-scheduled-poll.log';if($row-ne''){$parts=$row-split"`t";if($parts.Count-ge6-and$parts[1]-eq'success'){$scheduledRow=[ordered]@{id=[int64]$parts[0];status=$parts[1];type=$parts[2];sha256=$parts[3];encrypted=([int]$parts[4]-eq1);size_bytes=[int64]$parts[5]};break};if($parts.Count-ge2-and$parts[1]-eq'failed'){throw "Scheduled backup failed (id $($parts[0]))"}};Start-Sleep -Seconds 1};if($null-ne$scheduledRow){break}}
 if($null-eq$scheduledRow){throw 'Laravel schedule:run did not complete a due scheduled backup within 90 seconds'}
 $scheduledVerify=((Current-Artisan @('hospital:verify-backup',[string]$scheduledRow.id,'--json') 'upgrade-scheduled-verify.log')-join"`n")|ConvertFrom-Json
 if($scheduledRow.type-ne'scheduled'-or-not$scheduledRow.encrypted-or$scheduledVerify.status-ne'verified'-or$scheduledVerify.backup_log_id-ne$scheduledRow.id){throw 'Scheduler-created backup did not pass exact-ID verification'}

 $result.status='passed';$result.code_hashes=$codeHashes;$result.payload_manifest_sha256=$manifestSha;$result.payload_identity=$payloadIdentity;$result.builder_receipt=[ordered]@{path=$receiptPath;validator=$receipt.validator;files_checked=[int]$receipt.files_checked;validated_at_utc=$receipt.validated_at_utc};$result.integrity_basis='build_native_payload full-file validation receipt for this exact manifest/content identity; layered releases verify intentional deltas and observable code origin without rehashing shared runtimes';$result.release_identity=[ordered]@{visible_version=$visibleVersion;old_release_id=$oldIdentity.ReleaseId;corrected_release_id=$newIdentity.ReleaseId;same_version_different_content=$true;old_backend_class=$oldClassPath;candidate_backend_class=$newClassPath;old_backend_marker=$oldProbe.marker;candidate_backend_marker=$newProbe.marker;backend_hashes_differ=$true};$result.coverage=[ordered]@{shared_update_engine=$true;real_mariadb_php_caddy=$true;offline_backup_after_writer_stop=$true;persistent_cache_invalidated_offline=$script:offlineCacheInvalidated;real_additive_laravel_migration=$true;financial_domain_invoice_preserved=$true;failure_between_pointer_moves=$between;candidate_health_failure=$badHealth;laravel_schedule_run_due_backup=$true;windows_scheduler_or_service=$false;windows_service_registration=$false;inno_uac_upgrade=$false};$result.policy=[ordered]@{default_rejected=$defaultRejected;declared=$policy.Policy;added=@($policy.AddedMigrations);semantic_check='previous distinct release healthy after additive migration and both rollbacks'};$result.persistent=[ordered]@{before=$before;after=$after;sentinel='preserve-me';financial=[ordered]@{invoice_id=$financial.invoice_id;invoice_number=$financial.invoice_number;patient_name=$financial.patient_name;service_name=$financial.service_name;total_cents=$financial.total_cents;payment_amount_cents=$financial.payment_amount_cents;snapshot=$financialExpected;after_pointer_rollback='matched';after_health_rollback='matched';after_forward='matched'};config_sha256=$configHash;reseeded=$false};$result.backups=@($backups);$result.scheduled_backup=[ordered]@{trigger='php artisan schedule:run';attempt=$schedulerAttempt;configured_due_minute=$schedulerMinute;id=$scheduledRow.id;type=$scheduledRow.type;status=$scheduledRow.status;encrypted=$scheduledRow.encrypted;size_bytes=$scheduledRow.size_bytes;sha256=$scheduledRow.sha256;verification_status=$scheduledVerify.status;verified_id=$scheduledVerify.backup_log_id};$result.health=[ordered]@{login=$login;frontend_asset=$asset;old_after_pointer_failure=200;old_after_health_failure=200;candidate=200};$result.phases=@($phases);$result.previous_release_target=$activation.PreviousTarget
}catch{$result.status='failed';$result.error=$_.Exception.Message;throw}finally{Stop-One $script:caddy;Stop-One $script:php;Stop-One $mariaProcess;$result.processes=@($processes|%{[ordered]@{role=$_.role;pid=$_.pid;stopped=($null-eq(Get-Process -Id $_.pid -ErrorAction SilentlyContinue))}});foreach($secretFile in @('admin.ini','app.ini','hospital.env')){$secretPath=Join-Path $data ('config\'+$secretFile);if(Test-Path -LiteralPath $secretPath){Remove-Item -LiteralPath $secretPath -Force}};$result.synthetic_credentials_removed=$true;$result.finished_at_utc=(Get-Date).ToUniversalTime().ToString('o');$result|ConvertTo-Json -Depth 12|Set-Content (Join-Path $evidence 'native-upgrade-sandbox.json') -Encoding UTF8}
$result|ConvertTo-Json -Depth 12
