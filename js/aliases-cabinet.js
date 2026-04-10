// ══════════════════════════════════════════
// ALIASES CABINET — mapping et matching cabinet
// ══════════════════════════════════════════

var LOGO_B64 = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAALMAAAC0CAIAAABQc4ocAAABCGlDQ1BJQ0MgUHJvZmlsZQAAeJxjYGA8wQAELAYMDLl5JUVB7k4KEZFRCuwPGBiBEAwSk4sLGHADoKpv1yBqL+viUYcLcKakFicD6Q9ArFIEtBxopAiQLZIOYWuA2EkQtg2IXV5SUAJkB4DYRSFBzkB2CpCtkY7ETkJiJxcUgdT3ANk2uTmlyQh3M/Ck5oUGA2kOIJZhKGYIYnBncAL5H6IkfxEDg8VXBgbmCQixpJkMDNtbGRgkbiHEVBYwMPC3MDBsO48QQ4RJQWJRIliIBYiZ0tIYGD4tZ2DgjWRgEL7AwMAVDQsIHG5TALvNnSEfCNMZchhSgSKeDHkMyQx6QJYRgwGDIYMZAKbWPz9HbOBQAABFpUlEQVR42u29aXBmZ3Ye9pzzvnf5Fuw7Gmig0ftGsrnPkLOJokbjsSzJlkuRLMeOXZVKXMkPV6VS+ZVSfsaVVDneYqcs25WKbI1L20gznEUznBnuTXaz2XujN6CBbqCxb992733fc/LjfkA3OSN5JJEzDQinUGjiA/gt9z7v2c9zSFWxzeVP+wD0sb2CAApQ/qWAfPjX/HG+1qMidod9HvopvIrST+6Vd5HxyOFtS2c0f958SDd/tasz/orqiQ/BIjdgRDksFLs6Yzs5Gh/nnSIFPXhKRRMQuuV1mJ2nM3jHqv+HjvPHiT1t6glVBSkAKG9/J/6viJ9BACAiAmU2omKIPyZYbP4jCoIKK4GIaCceLt5RgGg6A+pVlVmJFZCPPS4nKLEKgUhAmcJjV2c82i6oNr+TqBCRQL2KZfOx40JEyHCmEIIQVGFoV2c82m6oAjkskqQBVUMmFafQh+Uvroy2HiEIlAhesVqpM334BXaE38E7ABAekDx+UE8QIaoTvnfl4hu3byyLN2yhUIISCCARhTpsmoAfclN1M+WpDyGuebepGalkIE+06vxvf+Od//CHr2040c1YVokUBFWobj70MbrCu8j48yAjBUQB5+Az7zMH+mBx/lyWfG9j+Y9ujc8lqShlIk7FuQwiqs7BpRAB4AG3iQVANh/wW+BQqIpTl4mKQJyqCBm6tLj+T7/+/vcm1i+vBn/8zk0H8i4jIBU4AKK5DywAVKCyi4yfBjjybIMImD3xYpZevDMZmbDozOrS4nevfHCtuqpskCnYZJZIKfIUCxQQA9imtch1D0MDqBVlASmEkYGcqFVBQxiUkPnOtbv/7tuvX79/e2CorRzhzffHry1UTBCqOKtKCiUGGcqvbzMbsouMn7j3GRJIBdb4TBwHV5bmlqqVPUHxbx9/YrhQnquvvHrr8qWlRQotwZAaCJMHeSWVlDQlfciISO5hQnJFBAKYKOCAFBzyqsgfnL7xh98/l1XrXzhx8L//hWefONRRS+vfPH1jJYP3qaXEqDiCy6spTW2x/aBhdwAyLFTEKRkOo5mkcWH6drFYfGJoeCyKwkOHk1m6c3/xrRvXKhvDz42MFJQE+XlWVgWpgPJMt6HcIxBiBikUUCLAOBXVLDQTteT3Xj83fuPennLnF049/fxjA5mXz50au3Z7+uz41PF9fV863i+1FYoUVBDAQKAebLbjCdz+1kQB8WxMRrRO9MHdiSRxQy3tY51tWpcC8PzYkU/tPepA70zf/M6t8cU0ESa36RPa/HAoAGEob7m0BDCBgdy5DPkH0/f/z+++dnp2Yu9I16//7KmXTwyU16SYyUiL+dnnjnlJvnnm+s2KUliGT4xq88qSArwdYxXzm7/5m9tcaSjEiVJizPWNtfcnbrZHLS8eONwO4zJnYxNkOlruKhbLU7WV6xsLC1mtIy51xzGATNUwa+aZGKRKzdtIROShwp5UmKqGXjl/4+unP6g1kqcPjv3aZ54e6yy5DRUwqwt9o7+3Z2px4+LUinB0YqwnzBrMSmRUhZgzZaLtZ052RqbLCKgCXLo/nSTJk4P79hXjRjXxkVpBp4bweLyn05SfePXO1Zur867WqA/tP9Td69UglYCNMjxRqhIQB8qoezVWSVNLU0n9ldPnr1yb6iwWv/zY4595bJS9rzYSU4QRDRXkC+1B+KXnj1+7f/61c7dOjXR9brSsaYXYqLAHC2/Lgtv21xkgATnmS8sLF6du95c7Xtx/qOylnta5GFqHEAYhSaa9UbSno7tSb8xsrEytL6tyf2tbCFKFZxUikCGQcaTK5MAF+uD+4n96+41bc0t7Owb+q88895l9fTYRdeIDVdtg49gYhAWXJf3t5VWv1ybmarXaif1DBQIk4yBQMk03dhcZP2ERwBEtevf69Supc0/vOzhWatFGjSJiY2OOSJEZDQI2qXRxsLerd138bG1jfnkZmbZ3tFtLokrqQzVwqgAsVa3+4PLtb5w+u9Fwx4b3/dpnnx5pL6DeIM08YC0HpCETUejJKDRg9He13p6aGb99r9jWdXS4UxqpsSwCgHOnZRcZP1lkqHqi9+5N3l5a3NPe8+zIaJil4IwsSNWQJWJmT+qYSYRi4pGO7kiCxZXVqbXlmUat3NrabYPQM6VghUR0zTW+cun8azfGjcafP3Lyl54+WrbOecmgXn1oNTJsYJliA8MKa0yWNTojWyxE524tTCzUx0Z6h9oL8I6IiJm3YT12myBjMx+ppASFCJRAJKKG6UZ14/TEDav8/L79I1HM3nnNrLWRjUgNDAEOpCCCYVaKne7taCu1tt+trd6tLC9srHQUih1xER4U0/nl1f/8/umL96c72zv+1rPP/OzYQFRzjhoeJMYGgQkMERGRBTEpsYgowTBLZaCnd34jPXNjJsnkiQP9ETzBqTKIQA+1hDWVXfNT7CLjL2czBCBREkDJC5Q8mIgS4NW56btLiyd6B57ZM0z1hL03xlIQKhkiJqiQgMBowkOYU+c7S8Xu9s5qo7a4ujK9tGiKLba1+M7E9NfPnF2r1E4M7fuVp54+1d5qKg4QIVhjYmMsM7EBGYAIUCYiBpGCScVCe7rbLt65d3t+rb+ja19/i/iaEYKxnpqVFc4/j27m5Mk8mn2k9OgXBiVPCHiAvbJ4wIDIkVejAa6sLr9y40rA5ssnTu2xYeREfYqAEQQEZpBVwCmMCispyAOeJKQNdcpBkiUXJqcuLixkoVXwwuxi2ZtT+/Y9f+xAS4C0nsTwBmooJGI2+enfVGObGkAJmYIZlDVMEP/+2Vv/4Vvnh/o6/qdf++xw4AOGAuAQD3rMBbrZ1EFWH0m9wdtCXzgCTF7HZAckYAUZxqr4M3N3UGs8OTDSHcXIRJ1aEzIZq8YomVzZgKBMakAMQ2DP3pXJxCIdNnrmwMG2zr571catyrorFp4+ceznHz/QngIVb402bOqssjHM5sEd1IfiDYYXBeA9NIgyV3v5sbGn9vffnFv7o3fvZEGYpEIEgiP11DyHDLLAA92zmwP9SxiTZosEMYyAlEgNbq0u3lld2NPSebC9qyxKqQsBUgnYGFKTawiFGihDCbm+EKsgmMTHxFXCmXvT9+bmKfGtttBWKlZdemu+kgKGPGVJbEwYBMrafBKGQreeUHN9YEgVAZA4B3CL1V/+9NH2UvSdM7c/uFszcQgViM+LrqrSbCIlfpSv/zZABm+1ZjMDHIBDkBpaSNILd26B6PjoUGcU+SSzlhyrWhLOix6an2zPyHJYQD0gopkTxMGi998Yv/InVy9ma8ufHtrzi8eOjUThxP3JN+5dO79xrxrD2CByTApn1LF4Ek/esUizsq4e6qACkDpGYom8iTPnTw53vHxyuFGr/efv315OWSlA3rRBkteGPfL3k2sg/wg2cNhtgYyHVTh5kBMX8Qf3p+Y21kf6+oc7u+ASD0cBgY0YKDyBDKm1BkpGCaQ+r4yIClmNzNXKxg+uXp1YWGorlD732MjJ0VGfSu/+fe/ec9Nri+9NrTppPD24PxJRETJKEFIhYmxqCmxWaAmWjUKTiMsNhQYB+dqvfOrAhev3rt66/t0Pir/83BhnsEbIKxndGlMxD+KuR84N3Q6xydZxIpBCvbLliaTy2sQ1G4Yvjh0fDAJO6obIMlk2RMS5l6pEIFIl8SxqlVhYlLwxp+dmv3X54tLKxnBr/19//OQT/b1o1OvVignQ090F1dWNjftLy/XUlds6Y2utqHohhVEiD4CheYWWWJlEAC/MJIESeYIRKdqgrRyfvnpt6n7t6OE97bElMoYBVecFxuSg5/wTEu0i4y8RRzWb7Sg1eHXi2nRl9UD/8DM9/YXEBaKsbClkMuyZhVmIxZASlIQEYsgxGa4wffP69bcmbydOTw4M/fWTxwaDSGq1hBxKIbNpoXCoo8+YcKlam15eXk6lvbWt1VpSJrZwIDU5LKB5FY4BFUadQqNEgFN4WHYy2Ns2Obd84c5atZY+eWJYlEIoxLNhUDMpuouMv4TKIAGBQFAoVAx9sLJ4dnayXC5/av/RLrbq4clIGFJoiIkMIf9iwECY6myIyIR0dz351pXxy8sLNio8d+DgF/bvi8AqEGtdHGdsIhNGbEPmrpa2YrltoZHNrK4tra61l4pxIUoVHBAsERMxKTc7gcDsyaQgIlgCETxDwGyof+/Qe9cXp+/O9fZ0jfaVWWHgiEAwICKA8wnZRw8Z2yCfkUEAsiByAGGR5XeunrlbXTsxuO/F3lGqZI0g8wEzWwNmwCiC3NMjOMCrMuCZ7lUq74/fXt2ot7e2nxgbPdBRdI16JM47RVQIGYHC5IoAlIj4ILhXS87dvVtZWS57OXn40EhHK4nazf5AgPIxeFXNI1oFQkUArQu8YYUaNl85c+err7x7cKD9H//dl0dbbZBVQQBHynYz8eWR50l3PdA/l48hAKnmY6TO0Aez09PVtbBUmp6b+70b04FSLUaVPEStcJApCTwoY3Ik5NWIspckDJZTYY4N2WS5urJ4/jtZ1fo0gmQUVlCMfSP0qXqXcugRwQOsQlQlyrxj8e9Nng4DazMpeBYHR+wIULB4y6FkjqXBJgs8yBdSLlWkZq1Dxo2ws2SpxfqsUfflFngKAguA8q7TZnrjkUtqPOrIaOpb76CGAl5Rf2P+XiGKvJegVCKOMqeAD1ihGqQoiBKjQZIGBNUg0zAVMFKyBQNGSGxNlqbOaaHsGplz6ihMvPXwickEVih0EjgRFjGk6r0RqxRoSOtZPUw1rTvWIDG2zgqRyJE6l6rnQKiRUGo9gg2vHAc2c0aosVY92Br/2hef3dPVUqkmbaWCV2+IoAqIEj+aya5tYE0UQqLwLCouMO8vzb42eb0BOTp04GTnULiSWFYbGbKWVK2CQZ6RGoKqUVinZOmOr33r4gdizEtHn+zLYNK0bnydUQqKYeIKFqCIA+Otr6W1IIDxxjt1rA1qiInGJ2av37k5tnfw2ODekjcxhakxWUAQH4nzwj6IkWaeSNkCUPEpB3/4nYuXr99oC90/+OUvHBjsFu8DdXFgotBSPm8AArE+kmmlbZDPICV4BYOFQtXHuwcy0Xdvjc/fnlxLgiMtvTatBxlElONADKn3RESqABFDIsogw3Gxry26vTrnq/f727q1tsFBuFoysWZtZKgYv3X93rmJmU899/jJrhbU60Fo0pBSdaHGi+D1rBGXigO9Pe2FsNjwpYC8gQ9gQIGQZXhp+CAwUdDInJU0igpf+f6lK+M3mfDrX/7M/sGOrFG3pGFkrSHxmWEGNUOTR5OcZTt0+3kBsxgShvEUA8/0DvrEXZi48d7UuD9Ah9tarRdWMcoCpMZb4tArK3lSzyzEJeJ9nT23l2fvLNw93tZRttbCGmEbhxWmb5+/8q1zl1YzurJe/fnHD37+8B6fOc2cJRNyWMuS2borllvjUnvmoLCZg0LBpASnII8sUwq4XksDQ2SLX33zwtffuqS29Ze/9OnD+ztdpWbg4iCwDFLPzI8+U892qJsQwNpQcYCQItPY61NDwwdGRxZj9yfL41ey5XoxMDYwXkPigrWh5cCyYYSGIkOhmqJgf3t/a9x+p9ZYyNQEHZJGbcXW+Zr8v2+c/cML748dGf61v/G5wKa/8703/9Pb19ZhCuU4APmCmVpba6QbXaW4r1iIJAvJhyyRQWw4NCYwBkEkUclaEzKFUfDty7O//fadOrf86s8++zPHOut1z4YLAQeWmYmYCFtMLaQ/NDS7m8/4sctpDCEyxIYITEREQgGopaNjUWtTG4trtY3ulq6usGSEiNgYw8j7MTjHvgWRwITBtfWViXplsKV7uNTqC8GVldWvvHF28v79zz9+4m8+8+TR1vKxfUO1jcq5Dy7euTvbN9DT0laaFzk/M5Gl60+N7h2wXHKNkiVDMIFlJoYykxBBxaRqI/vW+L1/9+qZNY9ff/Hkrzw5GK4vISaGlELLTIaZmQACG8CAfsQ49S4yftyoNYMCFCgxAMorIiDVmGiwtT2pVO9U1hbW1gc6uosmUKgaUiLNGU/yFCh7r0LGrIu/vnw/UNM32Pfq3ck/fuudRpb98ovPf/noWCyUZlmbDZ7Yt7ccFd+5fOsHN6bSrvagveXKzSuBjZ8cO1QWjYRgDKICTKBsBOzJMESz1IbhxenK//31M/O1xt988fjf+dQBXpunQLy4QhQRyBjDnE9eM4jRfIOPqFHZBjojgzLykhaI4AmJOEtkPVrEjrZ2zdbr8+vr6+vVru5OZmYmAuW3QImURCkhUkYQ22h6dqGRptfmZ169+O5gT8dvvPjp5wd6TDVTT4G1nCYFcaNDfb1Dw9fn1t744EKabJjADvcPjbR1FjIEIIShN9ZTXo8nIlKvYRBdXqz+06++s5iFP/PkgX/wuUNRsuY1czYsBKElS9YSM8EArLQNiHoedWTkOcb8iDU9I4JCmZlU4CS2YW9758paZXZxfiWtD/T0lYjDPMHV9BGVybNYFhOHwdRCZTVpLC0vHB/c83c/9dn9QQH1TAJnSdk5axTGe3V7OlqP7xvQNKu51MSF/pbOQ+0tcSrwAlZYAxWrMKoEYWNvrqX/4qvfm17feOrw3v/25WMtmUvE14tlMaVIDZGBtQpucig0s/27yPhLvkUlIvIEcD6OrJbIkWYMtVDv24OwWG69l1WmK8v1LBns6CqDSARGlVUJpJYoXDf86v2VSwuLa4ZG2rv/3pPPFWvOs09D8cwSsDdAEAmHlhnqC3FYHuyZqrm1LHj3nfNxag4M9lpjs8A4ZiWyuStpMF31//rrZ+7Nzb1weM8/+mtPt7o0VVPxMMYWWEmZrN2iXdAmMB5GhjyCJmV79HSRbmmQ3HcAKQxYiRCw926kXPrswaPlOL41e++9OxMrjIY16ghOM1VBuKD0yuSdV94/Gzek3ZiKq9xdXTHEkgicDRB6MmpYySsryBhQoJhbXVpP1jpaos6Wln/7yuv/8tvv3/eIDXMqATgROKbFuv72t96Zmr1zaKD7N156rtVl5BIv9ULRhgasYGNUm0OyuTkxHwUC7eqMv6hFyTu/QSACE/JQBWTzAR/jWbLWoFQst6yuVO8sLlQIfR2dpVSdSiMIF5LsOxfOn74xfmJs7FdPHN+orkyszxVaor3ljjDl2IaGSA0bSACvAIFYTEZ09v69pcbqp8dGXj5ydMXTN959/+adueHunj1dRamLt7TM9B9/cPXc9RvDPcX/5m/8bFcYUuoIylaJxLAxFLDm7mazuZj+NJu5i4yPPXwhFWXORLqjcouNFzdWZ5J1JzLW1SnWnl9f+M6599aWlj93+PhLRw71hbycZTfnZwsmPNjdb61BwASoAUPzcWcWA6bZJH3vzo1CHD0/ODoK+/hQe09/x+sXx9++crdgi/v2dIih33vjg1cvX+rqLP79L/3MSHvJOGEnlmGsIWOYTN5A9Kje/e2eA/0xEmEGpiBKqid6u9d19LXp8Uszd3qC0nqj+trNy61h6bNPPvP0QD9lru6xt7u3O2y5v7y+nLliMfbOMxvKZxe06Rp6xvTGylraONrR1cWc1ddbKPvF4weGe3p/6xtn/sVXv31x9mh3X99b564PdHT+2ktPH+xudXUfOB8EAdSTMbzFrKKMbUgZugN0BsAGDix5h4S2tbY1VFaqG3cWliZW1to7e18+8cTxzg6XVsXVfWgjEyxvNCZWltpLxb3tbVacsmECqzRnhYg3CKdn76ym9af7R4eLsXNrQVBCFvR1Fg4fHl4PzbnphZmlRleh5Zc+88STe7tN6kN1FmyYyFq1rCCCsgKb3C3b7KJud1TkfdhEec+Xz8iHKp8ZOjDa0ZdGgWtpPTJ24ECx0GikjjMfupSTEtNYVx9xMLWy0lAPESFlBYgBo8JgLLvk3sZqHAVDra0saVoIalFJI6LM7S8HB8cGorZupVJ3ofXUaDc3PCUVhmMDZXKcc8CRgJQULNvxMm9/ni4CAzCAJQ0ITEalVfVAW7dvZCC+dnPqztIGjBEvRkFejOpga7mz1DK/sbpQq6u1krdzEyHPXwF311YrSa2vpb0jjDQTT2FDNQGCyJ69ee3VH/xAVZeXFmMrQV2DrGFYrSEYaMBqaHNMgHQ7jsHvEGQoWOCBBsE1mfnARB1BhJVK0Egrjdp3bl69l1Ss2FjCIofw2lUK9ra1r6+t315ZTowV51UVSuqVmKrA9NoqE+1t6QwV4jTWsOgRB3RmcvF3v3cRVDw4MpClq3GJgTp8hYiVWC1JXv7HgxlHae5C2UXGT8OieCDbKp4pide2cikC+uLCSF/vgtbeunm14plcGHgjrIYw1tkWh9Hk4vKyiCGiZg6KwFh02czKYtGGo61d8J45sDUthnR5YeUrb5xbdoUXTjzx0pHhQr2m8LZk65qBA5jm0+RFQIOcqssojO4yuP20ohMGIsAqkRKYFcSGKTatAb0wMtzd0nK/svHarRuLbBSBkskUI11dpUJhdnG1UXdBznUAzf2VmbXVSpb2t3b0Guskc3BRMR5fXv+333/vXr3y3PH9v/rUiJueNdWks6OlocZELeAQZAEiqIEEqhZqmh2e25GmawcggwBWCwlVIPDECpAqAUFHqbKxts/Q58eOtrW1X1xbePXe5JJqJmpUu0I70NOdJjIzu2KYM++cNjmE7y0tOpWhnt6SmjRLUbR3amu/9c74XN0+t3/k779wpABteJdFcXspLnkT+7JBPoQCghgoqUAEsk1ZYncGMprbiUhz1ZGTlSgKQHtU9BkE6C8UPzd8cKTQMr549+uz1xaMssCmONIzoIFeXZ1a43pKLBmRYLmeLtY24tD3FYqZz4pRcaZBv/3e5emZ2Wf6O37jxVNxWvNK89XEBNQdBgGBLCkrEUgJwtqsADaVxS4yfqpZUJBs3QZVKAxQNoGkCoDFHW9v/8zIgbLQ5NrCG1PjG1AIRuNSa7EwWZmbXlmKgtB6VYPJjfWl9aX97V29YZwZs+T4j996/8r0/LE9A7/+2ZOdlGVZ5gir9cwGprsUKsETdIu6vNnubkBmW+9W2yF+xsP/SQQYUqCjtV3SVIEWNs7LcFf3F/Ydba34Wwv3Xp+frFl02nCsvSdp+LuL65EAXteg12v3I8ho2N1KwTrx75+7dHNu/mBn2y9+9vGS4ayWMhsA67U6WRu3ll3O4ICdtjGLdxIsHhYBusplo+oFoVerCBSPDfQ/vWcfRD64d+vc/KwGGGrvilGcXKpUa55DWnSV2Y2Ztri8p6O/Lvj901fOT82VwsIvfeqJoVJoMwmYlawC6/XMhFFYiP3OXMq5U3TGVv5giyZNgfYwLARBI3FgljQJGGninxrZ98zAqM3cmanxN2dmhga72kzh7lrt7noVId3fWKxXGsWoJShHf3Rh8oOZmRYb/soLzx/oKJnUa+ZgGGwagnriisWWyALiiXQXGY+oD/rhT6J5dbPFBMXANlwC8dZaBSFkCD6159Az/fsakrwzN3FnfWVkeGjVy421lRVgYb5iXXFg5OD3b82+cfuGCf2Xnzp6qq9VGhXj0ygiD7GFsJH4tOFaiqUCYL032EXGIwkLeShIgeT7i5SAFmvLYVR3GYxhppwYxTCVFc/tPXiob7DhkovTE74QUBxeXZi/n2FuOS0W+27Orb43PmHgXj517MnBNlmbs8aDPFhNEABwLkuraUehYADjvVEwbzLQ0w5Zxmh3jM5o2hIBMQtIRUPDbXGhkWUCECsDQXMrgRaZXxg9Uk/9nY21dYWxvOHk/Vv3GkFh1fmViWmubvzc8SMvDg7oxiICZbJiA7DxCgukWSaZay3GeSRE4oBwV2c8ig7og+FcUoHf2mpWDKPUeQKUDCkFHhYQVlHXRfZnDx7vK5Qkq5dDk/j0xtzMqriVjTWbVp4fG/700KAuLBprvQ0tR5YDYpMTojTSNEtrLS1lABSQ8K41efRENneePeAZVhX4XKWHoYHhB4TweUk87z4n6ST7M4eO95vYevGkFbi1RkUqy4/1tX3m0F6qroZRmElEKBtEjHwUlQDU62kjrbe0tyqcNyrMu8h45ONWJaK8G1chiKLQ2pwnjZoMngoSYWryMA6Ghc/s3d8Tx8pch6QuOdrb9dl9Y7ayojZzcWBtKeIIyHkYmlwq9bpzPi23FlNQCi87MWq1OwDaATanRMFgMMGIMBMIreWClSz3DJsHXkEwOUwCVi9yqLPd0v7fuXJnIUv3t7e91NdXTjJjDGyAQKN8bRYB5ISIlQBaSSJ2aWeUKGLygTWWOJ+/112d8SjpDH04A9r8VPkNDSMbN3toPqJh8lFIMgQW2dfRmm1UG5UGEt8RFQOYKChEUWwNs/HNyWQWhc//9+WKxFHQFpECLMxKuzpjm2CFiIgUCMPAZfYjRzl3QZq7eYkA1L2uz98TTwu19aX9+4aKhTBghKHLZyCN5Gs2t9ZIr62vFgqFQhxSTl+7E2WHfqzcOfU+SZMoiv6siFeViO4vLfUVo08f2J+tVSdXl+O2siGyZAMNFKLw+XJGajLVYqNWjwuFwDIBzLSVUtlFxqOd3tjUEEvLS7dv3S4Wiz/S/D+ckppfXHzy4MgvPfNYCXzl3v0GU87taQRELDnnJ+XFU3LARq1WKpZiZvXSrO3uImMbydr6+q3bt1T0I7ZjCyiqClUnEpYKj4+Ndmsy2t89MTs3V2sgioA87UleRXQTAIRUsV6vFYpxwKzOKUSJdpGxPZwMEQHQqNdnZmau37jBzMwsIt57VZVNUVU2hphPjIyMX/jgg/fOvfjkU6urqzfv3s9ATjYpXAEvqgooMVD3WK8nxUIptmxVmfOsyofAt4uMR9Sa5FWMQqFobfDmW2+ePXt2eWnJGGOMYeb8ey61Wu3e7Oxrr7959q03CyxjA6X2QvHSzYkq4ARk4J0QBUpbaVVkXiuNRqlUCgHO+4HNDryMOzM2yf3K/v4+ay2Ad9999/r1693d3eVyuVwuG2PSNG00GvV6fWlpaXl1NfWuq61tZHQ4Zn1sbN/Zq7emVuvH2wqSpXnYqgQIqYKAWiOtJ2m5JSSARMULGdp5nsYOREaecXLOlUvlkydOvPvuu20trRsbG9VqVTflgc5kNkyBuiOHjnd19yTAsb173r565/LE9IlThyANNiUnH9Kt6xsVEBWLIeX1GhJVoR2nfXemB5obe1F96smnnnv2Oedc7lXkULDW5gYlD08M8xMnH3/66efqjbpv1A4N9LS3t12ZmF3PPFmIeKZN3nhVABvVqgnCOChAASZis5NSnztLZ9BHTUnuahBRmiTHjh7dNzp648aNubk5732SJACMMUEQxHHc09MzMLSnra2znqXWiKtV+zpLR0dG3zx/8dbK2sneFtsAM5RVwCBPMBurG9CosyWGZsKkGuadobvI2AYKw3sPwDLPzMysrKw899xzbW1tANbX17Mss9Y654IgCKNIRTzUqXdp0lYK8nv8zKGh198/c25y6mjvEyFDFQRSYlIHIEtcYG0xDgGvBMmpXnY7hB99cc4xc67hkyQZHx+v1WpxHKdpWiwW29vbgyAolUrWWpdlxphSqTR5+/b6yjLbkItl77GvNRjt77k0MVlLIPpwZgwA1mppwFSKw9zLIALtdghvj4/EnOczAARBsLa29sorr0xNTbW2tpbL5TiO29vbS6VSS0tLZ2dnpVI58+6ZN15/wxoycTFlK5D20Jw6MDi1sDw1u0QWSh4KQrNutrpRD4yWYqMiAqIdiYsdaU2Y2TlnjAHQ09PT0tKytLT03e9+t1Ao9PX1tbW1MXOWZSsrK2tra41GY2llpaujo3/vsFNVIiiR12OjA6XThXfH757Y22W9CJExBMADa3UfGy1FIE/YiXnxHYsMVQ3DMM91dnV1nThx4vTp08xcqVTW1tYAZFkWhmF+1pMkaSmWXnj+eQ5s3TvLoSWCT0bb248O7rk6Oz9fSYeLgQIi3hAagmqGckwFhmRqiHWHYmNnZse3EtWq+tRTT7388sulUoko53fmOI7z4MVaOzo68sWXXx4a2FPPUiXSTMh7xz4Gnh07cG9t/vrsIgxJfv+Jq4msNbK2gg0BLwom3aFqY8fmQHNvg4icc/v27du7d+/c3Nz6+nqtVssD2lKp1NbW1tHRAa/eSZ3F+KyU75dgoyKP7+stFYMPbky8eHhQvLfGgLSaZHVHHeWS2Zq1xq6fsa1cjTxBTkSTk5NBEIyOjg4MDPT19amq9z5HTKFQWFldiUwQmQg2DA0ZcWADCrxHR9E+dXjfpQ/uTK3p3iJ8mpg4qCVJreG6O1oM4DYZSlV3IDp4p+qMre+rq6vnzp2rVCpBEJhNCcMwjuOlpaUL5y8AJowLURCHzEAGeMrybgw8MdxbTfWDW7NxEOQ7NBtOG863lYsP2jIIO9LV2Jk6A8BW4NrT0/P2229/4xvfGBsba2lpKRaLWZZVq9WlpaWbN292dna2tpVJucm0ZgyI2bN4zYweGdrT1dl2+fbkxsmBUAWgWl1ENI4CBUgNq9F80xt22mzrju0DzaNWACMjI0eOHLl69erMzEyxWHTOWWvr9boxplwuP//882B4ZBEZRSBsWYmgAYhE2wJ7dKTt7IUb48tHHutpAZA0vHFJqRx7kCJix54zYkDtDkts7Fid8bB8/vOf37Nnz9TU1OLiYp4XHxwc7OzsPHLkSGtra5okQWhIScg4cAAlQ3DKQmA8fezQa2+fvTq18ERfpwg2Gi7zSVsxMkBDYAyYtrq9dnXGdvM5giA4fvz44cOHkyTJ82B5PiPv3AmMJa8Ehdlcg0gCCxEANNrXvm/v3jMXx798/FBbkRar62K1LY7IK7H4gC0A0Z3nsPGOhwUz379/f319PU9g5OlR732WZUmSGGMAZSXOt3EBQirqwKKSWtUOphNHD07dX709s+yBpUq1tb0QQJBmbFk2l+XtvOCE8VdAJiYmLl++rKpRFLW0tIRhCODSpUuVSiWO4yAIQczEOa+WIG/iE2tBXkLosdGBQqnt9JXxBrBRrbWXikHAoo6h5L3m6/J23DCS3fE6g4j6+vq+9rWv3b17Ny+0JkkyPT3d1tZ26tSp/A+2Rgw2F1kx1JMhFlUnB3taezuiq3fX7zekUam2hQEizpwzopbIExPU6k7zNHa4zsgzoSMjIz//8z/vvZ+ZmZmYmJidnd2/f//P/dzPWWtFhPJZR2h+OajpahCg+bK+AvDCqRP3VlYvTSy4xLcXCsKaMUOJfT5ZvZvP2J5+BhEdPnx4bGysXq8TkbU2iqK8/09EhGFyIlHJRxFzKnNp9l0QMXDq4J7fITl/db5ST/sDI8QOonnf8I70Mv6KRK31eh1AHMetra2NRiNPkOdNgcYaIuhmXYwVoJyQg7FJCkyKzkifPH709sS9RpYWykVSUt9kIDUKoR0Ytf6V8EArlcq1a9fyIZQ4juM4npiY2NjYiKIoX3soOb9GczkiuDlMTwIGkRffRnxqrC+tpalI2FIK1JAnEMEqAWYnmpMdrjMIUNGurq433njj0qVLQ0NDRDQ9Pd3T0zMyMiIizDljykOhhTZJoXVzbzsTVPXwUFdfR3lyaa1gYQB4pSAnTdBda/LTEtlixniIjuvD/sQPb7l88Kdi2Lz00kt5mArgyJEjjz/+eN7dQ0xQMAyQc4dv0WvwQ8/FmfcDHdG+wfj+bL0nsAoY9pY8yAKioJ2nfbcFMvhDt/xHaQb60eoCeQnFe9/W1vbCCy9s/TJJkjzltTkqQn+mGytMBODEkdGLl6+1lyNGTtqlm2Q/uzxdP/1g4yOdl7o5IKQ/2pYQoGqMWV1d3Xo4L6oB8N7n8wf/pdCX8kzWodH+/s7WchxYA8MMMHRntu1sD53x0UNN8kOW4+E/xI8wPcD4+Li1du/evUmSTE1NHT16tLW1NW8H/LFqpOoJphzSUyePFlhDQIwFexDrTp3ze/Qn7/RDGHhYSdAPGRLZQoY216/mP+jy8vLp06drtZq1dt++fcePH2dm77219mFw/GiUqId4D/bGzq/UDFxvR6tk3rCwMZqvbYTusCr89kCGbu2DV4X6ZjxARreYQJu8XAoVVWU2ClaQbCIjdxRy3yJv9cszYFu9xH/mffVQD7ICzkQBGCYjkjsZ2lwJuqszforIUAV8rhR8PhxE7AHD5L3YZoe/bIUXCpYtZ+qhbvK83YuaGc4/U1tsqSJVEIk2t+s81PipOxUZ28ZGbt1ABVSY2HgizwSm5fWKgr1Xr1Ah2dw4Qg9/fZjP7yOw+C9fJTIAGELwUKGHnF7aoV6o3U6waJ5t9qqZiDFmbnXj0rVbywtL+0f3njpxULwYww8OsAJ/uvn/8d0C3dwJnlsrIlKYh97a5s7wB1HuTvA5tpVfTc2OcA8o8eTM3JtnLuwb6n/22VOLy+sKGMsP7qQCBP5Rtyj3MP5c5iyn7Nrivyd8qGb/kXTIznBFtwcyBBAIVAAVkBIv1upXxm9/7plTh4f662libBASIEpKAlXyANW8v7++scnjl1MqNR3ZfD/j1tdDqkFl8+uHkycPkEJ5pSXfGS6AA1KFZEACTC2vJS5TqGxnotBtgAwCBOoh8AqFI0oJZ27eOnLsQH9bMVOtZI6MEkBeoBCIgyroTiV5/eqNhpOt2Jfw0FbuJr0BIfcrtUnsuPW1BQ4CDDZ7+sgCBpKvhFXKWRQ0AzIv8MCdivvnv/PtepYIkG2FTrt+xicGjpzBV6FgwvTyqoHu7+tpJGkchbW6FvMlNHmRg9mpI0IjS3u6OiPDTpWZHngMzc6L/MTnSTFGs+yu5kO5NW4+qW6akYcTKzlYCCoM+NyK3Lw9M9i3p7VQyo0OP1Azu8j4BMJWJggYBipkgLuzd/fvHc4UhSgQaK1S6x/uQTMVrqIqKiBU1lZbijETVL0+FK18xEgweNOg0IP7/xEWnfynjz7WBA2ZSMUTEABTt2Z729sY5FUN5WZHN5eF7lqTT8D1JJCHIVAKLNcrHYU4IKjCeV+tVjo7O3SToUs1L2ogTZNysQDAkBoI5+uXVc3mEmZWEFg+5ETSh16WtpSFgtSRZqQpJCP1pJK3cJCKaKYMptW6m56eGhrq3PSNPpKm39UZH7fOyM+bAwzIQ8iI+AwoEFGWamVjIwpYVI1hgCTnNCCoarEQA4DnZruFNyqgfJxMm1ZKCH4LG5I3DOe/a95agjJ8TiIMIkvWIds8VQrAU1ARFICVjZqNbFSK0UzJqSFiyqdst1nMsp0yXQqIahHcFhcX5u5bwIvUkzSOggJDdbPlhlhz11DVGAMVATm2RBZEZMmpVpx4YGrivgNqQF01BeqZIyYhiKgHEtX1NHvr0pX7KxtQo54CCiG8uLpCMBaW1MAFmpjU4dz4zQS4c3eqb8+AwimQEaegFGg4R5uZ+Lz5dFuwRG4HZJDmyjnvilDg8f2HxoaHMy+G+d78gjUc0IMTrAowKVHmvGFWYjE8vrz8/Rs3plbX7y2tfOv02alKdaZa/+DGzWWv37905Y1zl+oiJrAXro8rAOJMxatem5xaqdbicqlBdGupcvb27MTixtd+cPru8saGo4o3iYAC2wB5Y2ppyoHp6Gwlyx64PTf/rbfOzK6shWE0dXd6bW1tV2d83LYEPm/ct7nBV20P40IYe6gCi9VaS0vJ5o29D51FL8icF8Crrohcmp25OD31zuXLKxuNVfVJIXz/xs3Dp07emL9/9e60BqbI/Oa7Z9Y3aqQQVZc4w9za2moLxfk0+d745DfOnp+sNO6sVwYOHbq1VPvqW+9/+70LCHmF8bvfeS0Vnbw709XVVSpGDF5N6hcuj6/UMzY0v75+bfy6iNdtlQrbFtZElUSBfLjDgAKIhzdMCqzUk9bWFjQrKs3OQAWBEUSRc94SXZ+YXq3WDu4/MDjQe2JsYO/wnuu3b4fFqKu9vLC0fPLwgWdOHvvee+e8108/eUqcJ++LcehF9/X3HBwd/p0//taaz555/vHFytrQcJ8xfOna1cdOHtxIG29dv/3NN872Du7p7OxpNLLejhZkKRHuLy61tLR88YVnao3srXfOPPnEqY6OTpdl+VTtrjX52BwMhSgeEGJZBYFEoMD9lZXm1iMVbP6NKhlCEISZSCPzc3dnA6I0dUdHR5zHUHfvzO3bnXHcGZjeQolE33jn/faOrpc+9YxLM8uGwKRqAKdYW692FKLDPR2t0HK2MRwFe1vLnz+y/7GO1i8cP1C/P//sob1ffPzAzfHxQKQnjrNGgjTraW8rFMqXr0+N35r+3AvPd3Z2eu/z5sK8nWw3Nvl4wNHMQ+SDp6rwGlh2hAbgvcaWASgM0db2RVUgIq6sbdys1ftbS5974mSj0WgPLHn0FcJfeO65/vZ2VjxzYHRmfb08NNIRBV41CAMo2BgvYogCwK2uHe7p2t/eBqDvqVMl4HBfj+nvUdXhzva9n30eQF31Z59+PIQyUXtIlaXVvuHex/dHdYf+ljAExCsTKE+37UatH58YVlKijGABVgFZ48mzNIDARsXQAkC+zEqFQaRoiB7dO/iN77xeKsRf/vynIoLGkaqSoYLiQHd3/tQBMNLaipxMgR7Mm+XrFC3h6SMHQLA5T0sQbGW9triDFYiB/qJRcOr8sbGh9z84n8mB3kLIzdBYYPIM+24+4xMwKfpQi0Ze6M6DFssmDqMPe6yU0yqVOPzyFz9vDUdM+agiM0Ml7wHacgP1oQaOh9RUM8g0hvN2MXqovE4fDadVcwoNop6erpe+8DkQ6+Y0xDaVbTOJxFsXmhQMUhgmFtjm9uYmb3y+i4aVxQmIC4EhwKsSNOdn0h/KONGP8Hg/tHRta8nSnxFTMLMTASinmtwBdfhtkc9ofvsQlzNBRAOGpkmj0djUJYAqQZkkNIZVjAi8GKKcBzK/bT+GX0PY5ID7cZo5iMg5z8TMzEQQ4Q93G+3qjE8cIbSlv0kgKII6WyLn0s3bqRAGNRuJAyIFDD1kBR5qCf4zo+QPNWX9F5EhokEQiuYdXwymHx6Z23ayLVaZS7Om1rzGeXcdebBTNJwWDAKmTW9ka+wAqkT5kmZ8si28PzT38AANum2hsW2Q8dDllU3+Tc4njs2HxpG0OdOuD9kh5Z8UMnSzORCb2+lpmyJjW83C69apJN1qtdKP9G7TJuHBT/Fdfvjt7sYmn9iFzvOatPUvAIUyNH/wQ6fyI20WPxFtTg+DditXu83DE7t9NMUPn0vd7BF/cCv0T0HIT/bt7gSi6W3hZ3wUGwLPzdvOj5jO1g+3i5tdZOzKThPevQS7souMXdlFxq7sImNXdpGxK7vI2JVdZOzKLjJ2ZRcZP2XRT/iPdQfvgn9YtkHdxKtITm3jHYHYWGxuwswHU1khpAyCQIyokFEW9iRMICUV79QGHmAgyLkBiQwEEA9WsAWwVbPNS3QiusnmJcin5X3+UgxkSqRimJwSU37AaLNRQClvDYGAoMpEopvl+IfLOs2humYOmh+1Ctw20BkiCauIUkbsmJ2oiiNJDFQUPudncg0lB1VBShCoKjIVgYIgBJ86SVzOoLBV1xAg3WzyefByRFDJSX48QH6LOUMNlAgGyNu2jPcwZKCkos2WIt18yx4KUfWqKuKbq7U+TCr3EEhoV2f8RSRQbs6rEosCotYQSH1WMyYiZsAFAXufGYYqgaCknmAgYKMQhkQBsYNRgabGxIom75Lh/Mx6EJqzsVAiaQ7JE0RhAficEjDHkDF5vylYnTIxMQAHCCjM6RGIcoIWIeSb+xRwpET51iV6qGmAdq3JX1gogoK8j0IDgmNKRQlxYB2hASFo4FzQ1PiwXjRmamRBBGaCqoWKOp+lPoojgoUqQKpEeY/HA0qupn4QKME6aKPeCOKYFKbJ3JQzuZGKAxkQq8vYhqpCEEBUNb/pIsKc8wqyF2cIBM45RR9SEvzRnoFda/Ln9CkFiobXb759/U/O3rk2uWCYRERBoDjRSKwlyx7ikKbQus9AeO/ijfGpKSJkUJD1bC5cm7o3N69knZISiANw5JWJCGRFDWAABqwnC+KF9drbH1wRgiMhA+FmA6EHERun4kAc2LVqFcQKA4REpMr1VE+fvbpacUDgoeDQI1AyxMbDKPEWOOgR7u/ZBsjwzGoxM79x4da97r6B77196dz1u85wJaO1mpCx6w0/vbBObDK1r783+epbF+sOc8v1DMHieiMjdsYQU/fQno2MicgxLdbSudWqhwHzxOL6Yi1VYg8SsAcp8exGIwHPrWQZ4IgnFqpLDSfEVW8aoIXVel2tI1y5df/Vty+vJ15g1ht+drniiNQGo4cPcxQ3lBqOljcaSnR3vXFvtaZEbnOnDh5hhbENrIkCCSMAPKS7Jzg1FLwVxuP3Zu804vXJiU+fHPPkr9+YLbYMnL9299lnj96ZdbVqtiiIW7rfe//ewrBfWVn9xS+dvDy5OLOUFo3UkqmWzp4z5ydHB7oKLcUzV++mGleX7jxzcnSws+wVhunVN8+vZ1E9zZwWMuDMxVmfcSVZO3WodWklO3dtam9buFxrPPX8Yzcmq5MzyeR96e9MLl+9kyShjRaefmbfhWsLx452Xrs2sbSw8djJ0Zv3l++vUQg3NuTG+lsJappEYPLQEaVdnfHn8TEAdd4CGtCtBfzWa7fZ4POfenL29syhfX0jw52vXbh/8PjQ88/2rlbqU/emjjw22NNX7AtRrW/09pZ+5uk9gsadufSdD24KKqnWf/DO1XuL1YXV1aHBtvWGv3Blhk3iwd9/44IXYqa7s8uz82tf+NT+sUO9yn6l4t46fba9xd24M/7B1dlKUksk+cLzh0V1pZIcPjbUM9g7sCeISoW2jlLUYm7emV9ZT1bXa5n3M7NLo6MdYyM933/3Fkwt1ezb3z1t0Nza2AxZ9RFNkGwDnWGMUaBA2lOmLz2/v2D2E6G3q31kuD9VgnfdXW0tjLb21mq1JpEn+BDwDTd6sDe03NVaVJ+lSbVeL0WlwnPPnjhyuFuQfPO77z/9xFgc8Vq12t4WtvQOiiAyqFUqHa3ltijo7irdtjapwSJbracH9vefHO6eml8eHWkLA25rj0TVmIypVrS4NH5vcup+X09XFNkkTYMwEOG+vq6RPf0CxJbq9bSrGD752D6nCNGMtkBb+5QeOZOyDfyMnDTRV9c7TDoYaitJKL5WXfBJrcX6Pb3h+XNX37t+b+7e/MlDh1qK9Ymb03PrldZCJIkHoEk90PrjR0fjIBwe7OjrLC8vN9pLpay22hKH3W2FtmJ7V2/P2Mg+y+pSNzzYu7ww887lqbOnb2ysLu/pNGNDPS3FYLCvt6+7jdINSTMAVhrI6l3FcGHm3tRsdXllrbUctLd3Zy6xlkUaJAmySlJPS4T+jqg9ikb6Ovf29RkROId89SdYQf6RbCneBn2gXmHE16v16bof622zLvMkd5aqezqKgUHNxNev3V5eXT984lhfOVxxuH1zorutHMRxmaiztTS/uBIUC1G58MHVycri0oH9w23dvecuXB7p6z483LeU6LlrE7Va5fmTh7sKhtSxjVYqjXPXJ7r6hiJLe3pbJPPvnx+vpO7zTx5Nk3QDOtJSmJ5fty2tg2Vz+dYsbDg20vXe+SvFYntXd2e5FGys1ttb48rGeldruRjYBvN7F243NtZPHNg32NcmWcqGwAzkbm8zKNoagvgzxhJ+Yg3RnzgyclpMIx4gZfYKVmUIiJ2AGV4REkG8skkBBoyCCA4AYFQdYElYxXPgFYEKkYJMM/mgmk8u1oBAQU5tQHniyeY8PIycqK+0mV+qQGOQBdRlmTUMtoAHWDJQJsrEMQPJ5q3YpIcDBMLwQOAUllIBCGEzgaHERA8NuEgz+YVIMiVmMtgcvISAqDk7y6qeKFNlpZAdJPUc15WJEEONeiF2YCsCVTamOaD3Q2r/Y4fLJ+5nKOBFWQXqCBYIPIhE4OochJm3lglw0AYkMhyoF6KM2Bg1KsSUGjJNjk7vDZvm+lRRNBdqkjiXeQoCBMhg1EnoiUMl1RRsnDJDYnDmhXxqjIQcO4XxHpyxE08BAQSXb2gjhmiWqWEizumhBV6FvCNjnbJ4tSRw3rIFkfoaRIiLiZD1sKz5nD5ByVgiIjhyTjkSEJMQGWVDopCMQGA26j2FUK+SEHmGN2DKKVk0IwRErArKydCbOVT6pLXIJ++BKgwRKUnSoLgQmKAhUDImMlBVwwSoS8mIqmfPbBkQnyXMRWarkhlS8aKGmfO1SJqvbCelPJUNMoEFU6pSU5gMltmQKiQVssoxeyGAjIEJ4XwgUIYy2MQWYoWkuQ7HqAcbw2SYmDS/N6IKJkOGQUJCwoA6Mnki3oEzYgNIRAFRCohSyMzQhEVBAZrZUMmX9oBAyioZsUdeDYQQYNiQ5uS0EjBUwepz0oegyUlHqkJbw3lN0h/T1Mrb0c/IvKjhENC0QWxqbI2isrzYUizMN7StrSUmIfKZksCura53dhQ4508BsbrABB7eqbL3FqTGOBILsDIATyJeyEQesICBT5yosUbFaqZkBJadV4Ol9fWWYjm0AWdemZKQV9eqbTYshCZlEIGVrGEATkGa3wAhTUAAAogHqXBUIdOq9YRMooGBMIlVMBtRslIXkJjCyupagbJiuTVTY0hhLMQbSJ0sgwoEBySAVQnhU9hKJsl6pb+jQFAP48kETOQyqIBMlslGkpTLBQMy5AkezJsVWiNg/QSQ8cnHJj6zTL//zt3/549PaxCrkmHKDP3BG1cuTs6duzy5Vk8Cw5aDgrHL65W3zpyHo5BtwMxMgQmu3Ly/mhpP1thIbChkFOTAHkbAXpGa6Mz9xj/72pV/+bvvXLixGNkgILJsyDAzLBOHNgWf/uDy7cU1NkSx5dDUPb197d7USoUCw8YoGxi+Mrlwb6VGBM+kzGQsTOgRNiio20hMVCPzlW+eXVhYjShkpiKbmALmoAoWIjJFMgUBXj0z/u4H48aE1hox1gEBG+agQBQTbk3fX1xZKwARsVAQEU3MrL7y/fdSsWQiMhZMqYBsQEFE1q6sN149c71uLawhE4Ij8bq1B2Fb5jMUIBPMVdw7N5bTamNqqTHaGb03Pntxdn1qo3AoiFGOszh8+/binfM3e/YPDR0bcu0D91eT67enpqv1kbH+Xpjf+t03n3nh8c89NXrm0nS1op9/bqS3xAxmgoAC0Go1feWr3znxxLGTY4dKFpdm194+Pz3QWf7MUyMXLk0uVlw1cy8/u7/QssdHhfPz9bPvXejrKH/queMo9FQ5/JNz1+erLrRm/96BP/j6WwP9vb/wpaeu3lyor9eOH+ob6211jICQgBrOq8XV6fnPHds7Pbl4YXq1K0BLa+nG9NynP//Y8uzK0sREXfjJTz2x7LkYd92Z2/jWmVt7R/ecPNxz9syNjZrvaQn27tv7lVfea2tv/Tu//NlLt2YvXJv+zNOH04jvV9Gw/K23ryytu2dP7R3rbf/a6fGl1XT/ns6ezi5pbV/I8Cfv37ZJ9cUnD/WU4ybL5Scm5jd/8zc/0VwEEb1+aW5RdaC/Z2Nhrrev81/957cGDwzen6sND3eevbbgW/t+8PqFxw71vHZ5fjkuXLg62RF1fPv1cx1Hh7791pWnT4ycu1M9enL47p2Za1PzM1XcHp/8zIm9C6vV85NLTmxnKZq7Ozd18/Zv/NKLvSWqavJvfv/88IHeazcXaj5649rCerl4++5CaPjOnWUJ8c137wzubb01OZ8I7s6nGvg3zlwutLbempyjIF6v6fDY3qUa3n3/RqWR3pq8dfz4fuf99Ynp5bVKf2dblejtS3Offmz/N9+8vtCIJ+/OLm242ZWlBneP375T3ahvZDRVDcn4clyOO0u35pffu7TY3lv66rfeGz6w5+yVmc6+7oUKdfS31ox55fs3j53o+5O3Z4KyZS6trDfGpxc697ScvzidqX3z3NXOkYHvv3F5YGDo1YuX6kH7jZsza2tL8/fnHzu01wNEDzqGaNtZk0Rw/toNWWukS4t37s5dna3Y1tafeXpv0STOeVtucaqc1b7w5IHBzpbawkpPS9gSYv9g+xefHOmw2tdaKrcW9wx3ptX66kYyNNTa3d8B1Vq1+sY778zMzcFL1N4+U+O3xucqoLmVFFn20pN7RwbLa/Mre8rhl57ee+hg/0K1ERZa1GF+ff5nnj7c29s3s7jYXogNaamj86XPnBzs64mCrFgIu/vahHi1UuvvL/UPDicKseb19y+8+f6FDSUBfJbVEikZ/fkX9h0dLn/qxP4njux33iKMD544/sSpk5WVBhPVUn3n7IwNyoU4TKqVg4M9Lz25r6u13F5Ab+z293QlFd9VzH7p8TEj6cryamj5/v3VsYNDzz15aH2jsbBcL7d3HXl8jMsdHNr29va1leVaPRkeGegZGEg2M2VoEoZ8/MrjE0RG3i938+5iUln9h79w4u998bgm66tri4NdHf/mX3/NVuY6Y6bMj3TSnt7i//bPv7K2OvPcsT3p6qrTTHRdMo19Yg0Gu8wffeX7Jw+MdBXlzvh7x8Z6Adq3p/cf//1ffubkKLwMdBZffvn5b//g8v/6T76iDX7xsb7/45/9xxvXbz79WG9QWyjUEqrVizYQ8uVy8MXHD/3v/+p3bk1MvnjyaLY2VWBnqqtadSVJYvGPH+7/5lf/uL+DBzqCuxPjPa1xmWC8/A9/+xf+0d/6a6H4CCi4ShyApVJb3Uizepps+MqKbay1F8tv/OC9r//h1198rK+QVSKtB5TNz9yJ3JJJKo3aSuYlypYDdXtHB1/5xvcGWoqxMf/LP/+9kf7SybGBjbmJl54be//02f/rX/7ByQO9Lz8z6jx983szcVRAUrPrcy8cG26h+v07N/u62x7q/Ml32H78luUTj03q3qeKsjUMVDKfMnlwY6PS01J898rk135w+X/8h7/QHmNupdLRWowsp5ljwxAJjNXMmYA3VLKa21OO79fT1Xqjv6XQgcCrVo23xEUhJUmNWc6cq9bb4tjGwf2NSmshardBvZHBWiUZn1n8/373u//df/0Lh7taJpYrxZaoxQbeOyEL74rGei9KxJZWa424FCepX13e6O8otkahc6LirSRqY2dtLXMFtl6dY9MQiQHvPAf2n/z71158YuDTJ0ZsGDvvAmMyptnVendsi6FJRY01nHkQyJpKrVEuxI5wd6G6p6ekiiBLy2F4P802Gune1pJrJH9y6da5u4mpZf/zrz5Tcy6Mgmo1qdWS9nLcWgg3uWc9IFACmY/XpPxEsuMKcY4ZMNYBLu+WYVy5OaOGTuwbIPVKEIH1hqxWpVY0ATuCsgZJAxShQF4zVhAx1KasFo4zhYQ+EgWMKqmB1p04toYpBKxPlSlRGzNdnFuZW1j89LGDoao11FAIaQEeygSGUzCBxXlha/PNeAYIAHGOjVEFSSZsHAwxWByTKAUZNEIiGiRkz92c29vTOtRWEBFm8qCGAIxQYSlfSS0KUvWsgAmcAiBLVHU+tMaKU5UGAjIUqPi09oOLd+e9febYyOGWIPNQFTBbhhdlyrm0Fc0NDdsUGWgu397cJ9AMW/ihFJ5ACER5Fyd8nsParCGQgnMK3/xHekAOq6S8pVUJArADmudJJffPtrKEki+I1+ZKRYZo3iH+YHUnfWRT2uZ1z4vmW4uBNaec1bzJC0Z+VBApTYR9pM5Om28s30revDI5+5s0d8EqgT6S4sw3+/xQxvPBcvSdU1H7cag5P84XUyXmbfRxtLm//qczcLDLubMr27Y/Y1d2kbEru8jYlV1k7MouMnZlFxm7souMXdlFxq7syi4ydmUXGbuyi4xd2UXGruwiY1d2kbErj5z8/x96ErOZJvBcAAAAAElFTkSuQmCC";


// ═══════════════════════════════════════════════════════════════
// ALIAS CABINET — mapping nom fiche → code Cogilog (localStorage)
// ═══════════════════════════════════════════════════════════════
var DEFAULT_CABINET_ALIASES = {
  // Exemples de base — l'utilisateur peut en ajouter via la modal
};

function _nAccAlias(s) {
  return (s||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().trim();
}

function getAliases() {
  try {
    const stored = JSON.parse(localStorage.getItem('cabinet_aliases') || '{}');
    return Object.assign({}, DEFAULT_CABINET_ALIASES, stored);
  } catch(e) { return Object.assign({}, DEFAULT_CABINET_ALIASES); }
}

function saveAlias(fromText, toCode) {
  try {
    const stored = JSON.parse(localStorage.getItem('cabinet_aliases') || '{}');
    stored[_nAccAlias(fromText)] = toCode.toUpperCase().trim();
    localStorage.setItem('cabinet_aliases', JSON.stringify(stored));
    _syncAliasesToFirebase('cabinet');
  } catch(e) { console.warn('Alias save failed:', e); }
}

function deleteAlias(fromKey) {
  try {
    const stored = JSON.parse(localStorage.getItem('cabinet_aliases') || '{}');
    delete stored[fromKey];
    localStorage.setItem('cabinet_aliases', JSON.stringify(stored));
    _syncAliasesToFirebase('cabinet');
  } catch(e) {}
}

function getAliasesText() {
  const aliases = getAliases();
  const entries = Object.entries(aliases);
  var contacts = window.CONTACTS_DENTISTES || {};
  var _norm = function(s) { return s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim(); };
  var existingKeys = new Set(entries.map(function(e) { return _norm(e[0]); }));
  // Ajouter automatiquement les noms de cabinets Cogilog comme alias
  if (typeof COGILOG_CLIENTS !== 'undefined') {
    Object.entries(COGILOG_CLIENTS).forEach(function([code, d]) {
      var nom = (d[3] || '').trim();
      if (!nom || nom.length < 3) return;
      var nomNorm = _norm(nom);
      if (!existingKeys.has(nomNorm)) {
        entries.push([nom.toLowerCase(), code]);
        existingKeys.add(nomNorm);
      }
      // Aussi ajouter les mots significatifs du nom (ex: "PREMIER SANTÉ" du "CENTRE PREMIER SANTÉ")
      var mots = nom.split(/[\s\-_,]+/).filter(function(m) { return m.length >= 4; });
      if (mots.length >= 2) {
        // Sous-combinaisons de 2+ mots consécutifs
        for (var i = 0; i < mots.length - 1; i++) {
          var sub = _norm(mots.slice(i, i + 2).join(' '));
          if (sub.length >= 6 && !existingKeys.has(sub)) {
            entries.push([mots.slice(i, i + 2).join(' ').toLowerCase(), code]);
            existingKeys.add(sub);
          }
        }
      }
    });
  }
  // Les contacts sont déjà visibles dans la base Cogilog compacte — pas besoin de les dupliquer comme alias
  // (les alias contacts auto causaient des faux positifs quand l'IA mislit un nom de praticien)
  // Ajouter les alias contacts manuels (priorité haute : définis par l'utilisateur)
  var contactAliases = {};
  try { contactAliases = JSON.parse(localStorage.getItem('contact_aliases') || '{}'); } catch(e) {}
  Object.entries(contactAliases).forEach(function([dr, aliasList]) {
    // Trouver le code cabinet pour ce praticien
    var drCode = '';
    for (var cabName in contacts) {
      if ((contacts[cabName] || []).includes(dr)) {
        for (var k in COGILOG_CLIENTS) {
          if ((COGILOG_CLIENTS[k][3] || '').trim() === cabName) { drCode = k; break; }
        }
        break;
      }
    }
    if (!drCode) return;
    (aliasList || []).forEach(function(alias) {
      if (!existingKeys.has(_norm(alias))) {
        entries.push([alias, drCode + ' (→ ' + dr + ')']);
        existingKeys.add(_norm(alias));
      }
    });
  });
  if (!entries.length) return '(aucun alias défini)';
  return entries.map(([from, to]) => '- ' + from + ' \u2192 ' + to).join('\n');
}

// ═══════════════════════════════════════════════════════════════
// INDEX COGILOG COMPACT — généré à l'exécution pour le prompt IA
// ═══════════════════════════════════════════════════════════════
function getCogilogCompactIndex() {
  if (typeof COGILOG_CLIENTS === 'undefined' || !COGILOG_CLIENTS) return '';
  var contacts = window.CONTACTS_DENTISTES || {};
  var statuts = window._gcStatuts || {};
  return Object.entries(COGILOG_CLIENTS).filter(function([code, d]) {
    // Exclure les clients inactifs
    var nom = (d[3] || '').trim();
    return statuts[nom] !== 'inactif';
  }).map(function([code, d]) {
    const nom   = (d[3] || '').trim();
    const cp    = (d[8] || '').trim();
    const ville = (d[9] || '').trim();
    const adr2  = (d[6] || '').trim();
    // Cherche les vrais contacts dans CONTACTS_DENTISTES (d[13] est presque toujours "Dr ???")
    var drList = contacts[nom] || [];
    var drReal = drList.filter(function(c) { return c !== 'Dr ???'; }).slice(0, 4);
    var contactPart = drReal.length ? ' | ' + drReal.join(', ') : '';
    const adr2Part = adr2 ? ' | ' + adr2 : '';
    return code + ' | ' + nom + ' | ' + cp + ' ' + ville + adr2Part + contactPart;
  }).join('\n');
}

// ═══════════════════════════════════════════════════════════════
// STANDARDISATION PRATICIEN — match fuzzy contre CONTACTS_DENTISTES
// ═══════════════════════════════════════════════════════════════
function standardizePraticien(rawPraticien, cabinetName) {
  if (!rawPraticien || !cabinetName) return 'Dr ???';

  // Vérifier les alias contacts manuels en priorité
  var _contactAliases = {};
  try { _contactAliases = JSON.parse(localStorage.getItem('contact_aliases') || '{}'); } catch(e) {}
  var _rawNorm = rawPraticien.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/^dr\.?\s*/i, '').trim();
  for (var _caDr in _contactAliases) {
    var _caList = _contactAliases[_caDr] || [];
    for (var _cai = 0; _cai < _caList.length; _cai++) {
      if (_caList[_cai].toLowerCase() === _rawNorm || _rawNorm.includes(_caList[_cai].toLowerCase())) {
        return _caDr; // Retourne le vrai nom du contact
      }
    }
  }

  // Source des contacts (Firebase CONTACTS ou CONTACTS_DENTISTES par défaut)
  var source = (typeof CONTACTS !== 'undefined' && Object.keys(CONTACTS).length)
    ? CONTACTS : (window.CONTACTS_DENTISTES || {});

  // Trouver la clé du cabinet dans la source (normalisation accents + case)
  var _normSP = function(s) { return s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toUpperCase().trim(); };
  var nomUp = _normSP(cabinetName);
  var matchKey = Object.keys(source).find(function(k) { return _normSP(k) === nomUp; });
  if (!matchKey) {
    matchKey = Object.keys(source).find(function(k) {
      return nomUp.includes(_normSP(k)) || _normSP(k).includes(nomUp);
    });
  }
  if (!matchKey) return 'Dr ???'; // Cabinet inconnu → pas de matching possible
  var contacts = source[matchKey];
  if (!contacts) {
    // Accès direct échoue (Unicode combinant) → chercher par itération
    for (var _sk of Object.keys(source)) {
      if (_normSP(_sk) === nomUp) { contacts = source[_sk]; matchKey = _sk; break; }
    }
  }
  if (!contacts) return 'Dr ???';
  // contacts ex: ["Dr MIRGHANI HASSAN", "Dr BENCHEIKH IMENE", ..., "Dr ???"]

  // Normaliser le praticien brut
  var raw = rawPraticien.toUpperCase().replace(/\s+/g, ' ').trim();
  // Retirer le préfixe "Dr " / "DR " pour la comparaison
  var rawClean = raw.replace(/^DR\.?\s*/i, '').trim();
  if (!rawClean) return 'Dr ???';

  // Extraire les mots significatifs du praticien brut (>= 2 caractères)
  var rawWords = rawClean.split(/[\s\-]+/).filter(function(w) { return w.length >= 2; });

  var bestMatch = null;
  var bestScore = 0;

  for (var ci = 0; ci < contacts.length; ci++) {
    var contact = contacts[ci];
    if (contact === 'Dr ???') continue;

    var contactClean = contact.toUpperCase().replace(/^DR\.?\s*/i, '').trim();

    // Match exact (après normalisation)
    if (contactClean === rawClean) return contact;

    // Score par mots communs + similarité
    var contactWords = contactClean.split(/[\s\-]+/).filter(function(w) { return w.length >= 2; });
    var score = 0;

    for (var wi = 0; wi < rawWords.length; wi++) {
      for (var cj = 0; cj < contactWords.length; cj++) {
        // Match exact de mot
        if (rawWords[wi] === contactWords[cj]) {
          score += 100;
        }
        // Match partiel (début de mot) — "MIRGH" matche "MIRGHANI"
        else if (contactWords[cj].indexOf(rawWords[wi]) === 0 || rawWords[wi].indexOf(contactWords[cj]) === 0) {
          score += 60;
        }
        // Match par inclusion (mot contenu dans l'autre) — "MENDE" dans "MENDES"
        else if (rawWords[wi].length >= 3 && (contactWords[cj].includes(rawWords[wi]) || rawWords[wi].includes(contactWords[cj]))) {
          score += 50;
        }
        // Match par distance d'édition (1-2 caractères de différence) — fautes de frappe
        else if (rawWords[wi].length >= 3 && contactWords[cj].length >= 3) {
          var _maxL = Math.max(rawWords[wi].length, contactWords[cj].length);
          var _common = 0;
          for (var _ci = 0; _ci < Math.min(rawWords[wi].length, contactWords[cj].length); _ci++) {
            if (rawWords[wi][_ci] === contactWords[cj][_ci]) _common++;
          }
          if (_common / _maxL >= 0.75) score += 40; // 75%+ de chars identiques
        }
      }
    }

    // Le nom de famille (premier mot après Dr) est plus important
    if (rawWords.length > 0 && contactWords.length > 0 && rawWords[0] === contactWords[0]) {
      score += 50; // bonus nom de famille identique
    }
    // Bonus si le premier mot raw commence comme un mot contact
    if (rawWords.length > 0 && contactWords.length > 0 && contactWords.some(function(cw) { return cw.indexOf(rawWords[0]) === 0 || rawWords[0].indexOf(cw) === 0; })) {
      score += 30;
    }
    // Bonus si les 3 premiers caractères du nom de famille sont identiques (ex: PHAT ≈ PHAM)
    if (rawWords.length > 0 && contactWords.length > 0 && rawWords[0].length >= 3 && contactWords[0].length >= 3 && rawWords[0].substring(0,3) === contactWords[0].substring(0,3)) {
      score += 30;
    }

    if (score > bestScore) {
      bestScore = score;
      bestMatch = contact;
    }
  }

  // Seuil minimum : 50 en général, 30 si le cabinet n'a qu'un seul contact (plus souple)
  var _realContacts = contacts.filter(function(c) { return c !== 'Dr ???'; });
  var _seuil = _realContacts.length === 1 ? 30 : 50;
  if (bestScore >= _seuil) return bestMatch;

  // Pas de fallback global — si le praticien n'est pas trouvé dans ce cabinet, retourner Dr ???
  return 'Dr ???';
}

// ═══════════════════════════════════════════════════════════════
// MATCHING LOCAL — fallback JS si Gemini ne retourne pas de code
// ═══════════════════════════════════════════════════════════════
function matchCabinetLocal(scannedText) {
  if (!scannedText || typeof COGILOG_CLIENTS === 'undefined' || !COGILOG_CLIENTS) return null;
  var q = _nAccAlias(scannedText);
  if (!q) return null;

  // 1. Vérifier les alias (exact puis partiel)
  var aliases = getAliases();
  if (aliases[q]) return aliases[q];
  for (var _ak in aliases) {
    if (q.includes(_ak) || _ak.includes(q)) return aliases[_ak];
  }

  // 2. Extraire les mots significatifs du texte (>= 3 caractères)
  var words = q.split(/[\s\-_,;:.()']+/).filter(function(w) { return w.length >= 3; });
  // Mots à ignorer (trop génériques)
  var stopWords = ['les','des','pour','avec','dans','une','sur','par','pas','est','que','qui','tout','entre','cette','sans','plus','mais','son','ses','nos','aux','ete','non','oui','merci','svp','urgent','urgence','couronne','bridge','inlay','onlay','ceramique','metal','zirconium','prothese','appareil','implant','pilier','empreinte','scan','patient','teinte','solidarise','unitaire','dr','docteur','cabinet','centre','dental','dentaire'];

  // 2. Construire un index inversé praticien→code depuis CONTACTS_DENTISTES
  // (d[13] dans COGILOG_CLIENTS est presque toujours "Dr ???" — on utilise la vraie source)
  var _contacts = window.CONTACTS_DENTISTES || {};
  // Map : nom_cabinet_normalisé → code_cogilog (construit une seule fois par appel)
  var _nomToCode = {};
  Object.entries(COGILOG_CLIENTS).forEach(function([code, d]) {
    var n = _nAccAlias(d[3] || '');
    if (n) _nomToCode[n] = code;
  });

  // 3. Recherche dans COGILOG_CLIENTS
  var bestCode = null;
  var bestScore = 0;
  Object.entries(COGILOG_CLIENTS).forEach(function([code, d]) {
    var nom   = _nAccAlias(d[3] || '');
    var ville = _nAccAlias(d[9] || '');
    var adr   = _nAccAlias(d[6] || '');
    // Vrais contacts depuis CONTACTS_DENTISTES (la clé est le nom du cabinet tel que dans d[3])
    var drList = _contacts[d[3] || ''] || [];
    var contactStr = _nAccAlias(drList.filter(function(c) { return c !== 'Dr ???'; }).join(' '));
    var score = 0;

    // Match direct texte complet → nom cabinet (priorité max)
    if (nom && (nom.includes(q) || q.includes(nom))) {
      score = Math.max(score, nom.length + 2000);
    }
    // Match direct texte complet → ville
    if (ville && ville.length >= 4 && (ville.includes(q) || q.includes(ville))) {
      score = Math.max(score, ville.length + 500);
    }
    // Match direct texte complet → adresse
    if (adr && adr.includes(q)) {
      score = Math.max(score, adr.length + 200);
    }
    // Match direct texte complet → contacts praticiens (très fiable : praticien = un seul cabinet)
    if (contactStr && contactStr.includes(q)) {
      score = Math.max(score, q.length + 1500);
    }

    // Match par mots-clés extraits (pour textes longs : commentaires, etc.)
    words.forEach(function(w) {
      if (stopWords.indexOf(w) !== -1) return;
      if (nom && nom.includes(w) && w.length >= 3)       score += 80 + w.length * 15;
      if (ville && ville.includes(w) && w.length >= 4)   score += 50 + w.length * 5;
      if (contactStr && contactStr.includes(w) && w.length >= 4) score += 120 + w.length * 15;
      if (_nAccAlias(code).includes(w))                  score += 30;
    });

    if (score > bestScore) { bestScore = score; bestCode = code; }
  });
  // Seuil minimum : évite les faux positifs sur mots isolés courts.
  // Matchs directs (2000+/1500+/500+) passent toujours.
  return (bestScore >= 200) ? bestCode : null;
}
