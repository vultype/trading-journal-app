import { redirect } from 'next/navigation'

// Halaman lama — diganti route generic /terminal/data/macro/[key]. Redirect
// permanen (302 di dev, cukup buat SPA-routing) supaya link lama tidak mati.
export default function DxyRedirect() {
  redirect('/terminal/data/macro/dollar')
}
