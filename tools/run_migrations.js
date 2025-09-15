#!/usr/bin/env node
/**
 * Simple migration runner for db/migrations SQL files.
 * Usage: node tools/run_migrations.js --url <DATABASE_URL> [--yes]
 * It will apply files in lexical order.
 */
const fs = require('fs')
const path = require('path')
const { Client } = require('pg')

function usage(){
  console.log('Usage: node tools/run_migrations.js --url <DATABASE_URL> [--yes]')
  process.exit(1)
}

const args = process.argv.slice(2)
let dbUrl = process.env.DATABASE_URL
let autoYes = false
for(let i=0;i<args.length;i++){
  if(args[i]==='--url') dbUrl = args[i+1], i++
  if(args[i]==='--yes') autoYes = true
}

if(!dbUrl) usage()

const migrationsDir = path.join(__dirname, '..', 'db', 'migrations')
if(!fs.existsSync(migrationsDir)){
  console.error('migrations dir not found:', migrationsDir)
  process.exit(1)
}

const files = fs.readdirSync(migrationsDir).filter(f=>f.endsWith('.sql')).sort()
if(!files.length){
  console.log('No migrations found in', migrationsDir)
  process.exit(0)
}

console.log('Found migrations:')
files.forEach(f=>console.log(' -', f))
if(!autoYes){
  const readline = require('readline')
  const rl = readline.createInterface({input:process.stdin, output:process.stdout})
  rl.question('Apply these migrations to '+dbUrl+' ? (y/N) ', ans=>{
    rl.close()
    if(ans.toLowerCase()!== 'y'){
      console.log('Aborted')
      process.exit(0)
    }
    run()
  })
} else run()

async function run(){
  const client = new Client({ connectionString: dbUrl })
  try{
    await client.connect()
    for(const file of files){
      const p = path.join(migrationsDir, file)
      const sql = fs.readFileSync(p, 'utf8')
      console.log('Applying', file)
      try{
        await client.query(sql)
        console.log('Applied', file)
      }catch(err){
        console.error('Error applying', file, err.message)
        await client.end()
        process.exit(2)
      }
    }
    console.log('All migrations applied successfully')
    await client.end()
  }catch(err){
    console.error('Fatal error:', err.message)
    try{ await client.end() }catch(e){}
    process.exit(3)
  }
}
