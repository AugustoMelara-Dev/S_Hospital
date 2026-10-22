<?php

declare(strict_types=1);

namespace App\Actions\Backups;

use RuntimeException;

/**
 * Removes account-specific object definers from mysqldump/mariadb-dump DDL.
 *
 * Dump tools emit object definitions on dedicated lines. Restricting the
 * transformation to those lines prevents user data containing SQL-looking
 * text from being modified. Imported objects then belong to the account that
 * performs the restore, while `SQL SECURITY DEFINER` remains intact.
 */
class PortableMysqlDumpSanitizer
{
    private const ACCOUNT = '(?:CURRENT_USER(?:\(\))?|(?:`(?:``|[^`])+`|\'(?:\'\'|[^\'])+\'|"(?:""|[^"])+"|[A-Za-z0-9_.%:-]+)\s*@\s*(?:`(?:``|[^`])+`|\'(?:\'\'|[^\'])+\'|"(?:""|[^"])+"|[A-Za-z0-9_.%:-]+))';

    public function sanitize(string $sql): string
    {
        $lines = preg_split('/(?<=\n)/', $sql);
        if ($lines === false) {
            throw new RuntimeException('No se pudo procesar el dump SQL para hacerlo portable.');
        }

        return implode('', array_map($this->sanitizeLine(...), $lines));
    }

    public function sanitizeFile(string $sourcePath, string $targetPath): void
    {
        $source = @fopen($sourcePath, 'rb');
        if ($source === false) {
            throw new RuntimeException('No se pudo abrir el dump SQL original.');
        }

        $target = @fopen($targetPath, 'wb');
        if ($target === false) {
            fclose($source);
            throw new RuntimeException('No se pudo crear el dump SQL portable.');
        }

        try {
            while (($line = fgets($source)) !== false) {
                $this->writeAll($target, $this->sanitizeLine($line));
            }

            if (! feof($source)) {
                throw new RuntimeException('No se pudo leer por completo el dump SQL original.');
            }
        } finally {
            fclose($target);
            fclose($source);
        }
    }

    private function sanitizeLine(string $line): string
    {
        $trimmed = ltrim($line);
        if ($trimmed === '' || str_starts_with($trimmed, '--') || str_starts_with($trimmed, '#') || str_starts_with($trimmed, '/* ')) {
            return $line;
        }

        $line = $this->sanitizeVersionedComments($line);

        if (preg_match('/^\s*(?:CREATE|ALTER)\s+/i', $line) !== 1) {
            return $line;
        }

        return $this->replace(
            '/^(\s*(?:CREATE|ALTER)\s+(?:(?:ALGORITHM\s*=\s*\S+)\s+)?)DEFINER\s*=\s*'.self::ACCOUNT.'\s+/i',
            '$1',
            $line,
        );
    }

    private function sanitizeVersionedComments(string $line): string
    {
        $result = '';
        $quote = null;
        $length = strlen($line);

        for ($index = 0; $index < $length;) {
            $character = $line[$index];

            if ($quote !== null) {
                $result .= $character;
                if ($character === '\\' && $index + 1 < $length) {
                    $result .= $line[$index + 1];
                    $index += 2;
                    continue;
                }
                if ($character === $quote) {
                    if ($index + 1 < $length && $line[$index + 1] === $quote) {
                        $result .= $line[$index + 1];
                        $index += 2;
                        continue;
                    }
                    $quote = null;
                }
                $index++;
                continue;
            }

            if ($character === "'" || $character === '"' || $character === '`') {
                $quote = $character;
                $result .= $character;
                $index++;
                continue;
            }

            if (substr($line, $index, 3) !== '/*!') {
                $result .= $character;
                $index++;
                continue;
            }

            $end = strpos($line, '*/', $index + 3);
            if ($end === false) {
                $result .= substr($line, $index);
                break;
            }

            $comment = substr($line, $index, $end + 2 - $index);
            $portable = $this->replace(
                '/^(\/\*!\d{5,6}\s+)DEFINER\s*=\s*'.self::ACCOUNT.'\s*/i',
                '$1',
                $comment,
            );
            if (preg_match('/^\/\*!\d{5,6}\s*\*\/$/', $portable) !== 1) {
                $result .= $portable;
            }
            $index = $end + 2;
        }

        return $result;
    }

    /** @param resource $target */
    private function writeAll($target, string $contents): void
    {
        $offset = 0;
        $length = strlen($contents);
        while ($offset < $length) {
            $written = fwrite($target, substr($contents, $offset));
            if ($written === false || $written === 0) {
                throw new RuntimeException('No se pudo escribir por completo el dump SQL portable.');
            }
            $offset += $written;
        }
    }

    private function replace(string $pattern, string $replacement, string $subject): string
    {
        $result = preg_replace($pattern, $replacement, $subject);
        if ($result === null) {
            throw new RuntimeException('No se pudo normalizar un definidor del dump SQL.');
        }

        return $result;
    }
}
