#Requires -Version 5.1
$ErrorActionPreference='Stop';Set-StrictMode -Version Latest
. (Join-Path $PSScriptRoot 'lib\native_initial_repair.ps1')
$root=Join-Path ([IO.Path]::GetTempPath()) ('s-hospital-initial-repair-'+[guid]::NewGuid().ToString('N'))
try{
 $install=Join-Path $root 'program';$releases=Join-Path $install 'releases';$old=Join-Path $releases 'old';$new=Join-Path $releases 'new';$config=Join-Path $root 'data\config'
 New-Item -ItemType Directory -Path $old,$new,$config -Force|Out-Null
 if((Assert-NativeInitialReleaseMutationPath -Path $old -ReleasesRoot $releases)-ne[IO.Path]::GetFullPath($old)){throw'Release mutation guard changed a valid path.'}
 $future=Join-Path $releases 'future'
 if((Assert-NativeInitialReleaseMutationPath -Path $future -ReleasesRoot $releases -AllowMissing)-ne[IO.Path]::GetFullPath($future)){throw'Release mutation guard rejected a safe future path.'}
 $outsideRejected=$false
 try{[void](Assert-NativeInitialReleaseMutationPath -Path (Join-Path $install 'outside') -ReleasesRoot $releases -AllowMissing)}catch{$outsideRejected=$true}
 if(-not$outsideRejected){throw'Release mutation guard accepted a path outside releases.'}
 $outside=Join-Path $root 'outside-target';New-Item -ItemType Directory -Path $outside -Force|Out-Null
 $linked=Join-Path $releases 'linked-outside';New-Item -ItemType Junction -Path $linked -Target $outside|Out-Null
 $reparseRejected=$false
 try{[void](Assert-NativeInitialReleaseMutationPath -Path $linked -ReleasesRoot $releases)}catch{$reparseRejected=$true}
 if(-not$reparseRejected){throw'Release mutation guard accepted a reparse point.'}
 Set-Content -LiteralPath (Join-Path $old 'marker') -Value old;Set-Content -LiteralPath (Join-Path $new 'marker') -Value new;Set-Content -LiteralPath (Join-Path $config 'hospital.env') -Value 'sentinel-preserve'
 $current=Join-Path $install 'current';New-Item -ItemType Junction -Path $current -Target $old|Out-Null
 $context=Start-NativeInitialRepairActivation -CurrentPath $current -CandidateRoot $new -ReleasesRoot $releases
 if((Get-NativeInitialCurrentTarget $current $releases)-ne[IO.Path]::GetFullPath($new)){throw'Candidate was not activated.'}
 if((Get-Content -LiteralPath (Join-Path $config 'hospital.env') -Raw).Trim()-ne'sentinel-preserve'){throw'Configuration changed during activation.'}
 Restore-NativeInitialRepairActivation -Context $context
 if((Get-NativeInitialCurrentTarget $current $releases)-ne[IO.Path]::GetFullPath($old)){throw'Rollback did not restore old release.'}
 $context=Start-NativeInitialRepairActivation -CurrentPath $current -CandidateRoot $new -ReleasesRoot $releases
 Complete-NativeInitialRepairActivation -Context $context
 if((Get-NativeInitialCurrentTarget $current $releases)-ne[IO.Path]::GetFullPath($new)-or(Test-Path -LiteralPath $context.PreviousPointer)){throw'Completion did not retain candidate cleanly.'}
 $state=[pscustomobject]@{schema_version=2;status='in_progress';phase='database_files_initialized';release_id='2026.09.28.5-9b637d42ed3a'}
 $eligibility=@{InstallState=$state;PreviousReleaseId='2026.09.28.5-9b637d42ed3a';CandidateVersion='2026.09.28.6';PreviousMariaDbVersion='11.4.13';CandidateMariaDbVersion='11.4.13';CandidateDatabasePolicy='no_schema_change';PreviousIntegrityReady=$true;SchemaCompatible=$true;PersistentConfigurationReady=$true;DatabaseFilesReady=$true;InstalledServiceCount=0}
 if(-not(Test-NativeFailedInitialRepairEligibility @eligibility)){throw'Pinned failed-initial repair contract rejected the exact recoverable state.'}
 foreach($mutation in @(
  @{Name='wrong phase';Key='InstallState';Value=[pscustomobject]@{schema_version=2;status='in_progress';phase='prepared';release_id='2026.09.28.5-9b637d42ed3a'}},
  @{Name='wrong release';Key='PreviousReleaseId';Value='2026.09.28.5-other'},
  @{Name='wrong candidate';Key='CandidateVersion';Value='2026.09.28.7'},
  @{Name='runtime change';Key='CandidateMariaDbVersion';Value='11.4.14'},
  @{Name='schema policy';Key='CandidateDatabasePolicy';Value='backward_compatible_additive'},
  @{Name='schema mismatch';Key='SchemaCompatible';Value=$false},
  @{Name='corrupt previous';Key='PreviousIntegrityReady';Value=$false},
  @{Name='missing config';Key='PersistentConfigurationReady';Value=$false},
  @{Name='missing database';Key='DatabaseFilesReady';Value=$false},
  @{Name='service exists';Key='InstalledServiceCount';Value=1}
 )){
  $case=@{};foreach($entry in $eligibility.GetEnumerator()){$case[$entry.Key]=$entry.Value};$case[$mutation.Key]=$mutation.Value
  if(Test-NativeFailedInitialRepairEligibility @case){throw"Pinned failed-initial repair accepted $($mutation.Name)."}
 }
 $servicesState=[pscustomobject]@{schema_version=2;status='in_progress';phase='services_installed';release_id='2026.09.28.6-99fefd4d5400'}
 $servicesEligibility=@{InstallState=$servicesState;PreviousReleaseId='2026.09.28.6-99fefd4d5400';CandidateVersion='2026.09.28.7';PreviousMariaDbVersion='11.4.13';CandidateMariaDbVersion='11.4.13';CandidateDatabasePolicy='no_schema_change';PreviousIntegrityReady=$true;SchemaCompatible=$true;PersistentConfigurationReady=$true;DatabaseFilesReady=$true;InstalledServiceCount=6;ApplicationServiceAccountsRepairable=$true;DatabaseServiceAccountReady=$true}
 if(-not(Test-NativeFailedServicesRepairEligibility @servicesEligibility)){throw'Pinned failed-services repair rejected the exact recoverable state.'}
 foreach($mutation in @(
  @{Name='wrong services phase';Key='InstallState';Value=[pscustomobject]@{schema_version=2;status='in_progress';phase='schema_initialized';release_id='2026.09.28.6-99fefd4d5400'}},
  @{Name='wrong services release';Key='PreviousReleaseId';Value='2026.09.28.6-other'},
  @{Name='wrong services candidate';Key='CandidateVersion';Value='2026.09.28.8'},
  @{Name='services runtime change';Key='CandidateMariaDbVersion';Value='11.4.14'},
  @{Name='services schema policy';Key='CandidateDatabasePolicy';Value='backward_compatible_additive'},
  @{Name='services schema mismatch';Key='SchemaCompatible';Value=$false},
  @{Name='services corrupt previous';Key='PreviousIntegrityReady';Value=$false},
  @{Name='services missing config';Key='PersistentConfigurationReady';Value=$false},
  @{Name='services missing database';Key='DatabaseFilesReady';Value=$false},
  @{Name='missing service';Key='InstalledServiceCount';Value=5},
  @{Name='unrecognized application account';Key='ApplicationServiceAccountsRepairable';Value=$false},
  @{Name='database account mismatch';Key='DatabaseServiceAccountReady';Value=$false}
 )){
  $case=@{};foreach($entry in $servicesEligibility.GetEnumerator()){$case[$entry.Key]=$entry.Value};$case[$mutation.Key]=$mutation.Value
  if(Test-NativeFailedServicesRepairEligibility @case){throw"Pinned failed-services repair accepted $($mutation.Name)."}
 }
 Write-Output 'PASS initial pre-database repair activation, rollback, completion and config preservation.'
}
finally{
 if(Test-Path -LiteralPath $root){
  $temp=[IO.Path]::GetFullPath([IO.Path]::GetTempPath()).TrimEnd('\')+'\';$full=[IO.Path]::GetFullPath($root)
  if(-not$full.StartsWith($temp,[StringComparison]::OrdinalIgnoreCase)-or[IO.Path]::GetFileName($full)-notmatch'^s-hospital-initial-repair-[0-9a-f]{32}$'){throw'Refusing unsafe test cleanup path.'}
  Remove-Item -LiteralPath $full -Recurse -Force
 }
}
